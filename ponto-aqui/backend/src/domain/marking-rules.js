const tiposMarcacao = new Set(["entrada", "saida_intervalo", "retorno_intervalo", "saida"]);
const origensMarcacao = new Set(["online", "offline_sincronizada"]);
const MAX_DESVIO_SEGUNDOS = 5 * 60;

function distanciaMetros(latitudeA, longitudeA, latitudeB, longitudeB) {
  const toRadians = (graus) => graus * Math.PI / 180;
  const raioTerra = 6371000;
  const deltaLatitude = toRadians(latitudeB - latitudeA);
  const deltaLongitude = toRadians(longitudeB - longitudeA);
  const latitudeInicial = toRadians(latitudeA);
  const latitudeFinal = toRadians(latitudeB);
  const a = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(latitudeInicial) * Math.cos(latitudeFinal) * Math.sin(deltaLongitude / 2) ** 2;
  return 2 * raioTerra * Math.asin(Math.sqrt(a));
}

function coordenadaValida(valor, minimo, maximo) {
  return typeof valor === "number" && Number.isFinite(valor) && valor >= minimo && valor <= maximo;
}

function classificarMarcacao({ setor, latitude, longitude, selfieUrl, desvioServidorSegundos }) {
  if (setor.exigeSelfie && !selfieUrl) return { situacao: "recusada", motivo: "selfie_obrigatoria" };
  if (!Number.isInteger(desvioServidorSegundos) || Math.abs(desvioServidorSegundos) > MAX_DESVIO_SEGUNDOS) {
    return { situacao: "pendente_analise", motivo: "desvio_relogio_excessivo" };
  }
  if (setor.ignoraLocalizacao) return { situacao: "aceita", motivo: "localizacao_ignorada", dentroPerimetro: null, distanciaMetros: null };

  const temCoordenadas = coordenadaValida(latitude, -90, 90) && coordenadaValida(longitude, -180, 180);
  if (!temCoordenadas) {
    return { situacao: setor.politicaForaPerimetro === "pendente_analise" ? "pendente_analise" : "recusada", motivo: "coordenadas_obrigatorias", dentroPerimetro: false, distanciaMetros: null };
  }
  const distancia = distanciaMetros(latitude, longitude, setor.latitude, setor.longitude);
  const dentroPerimetro = distancia <= setor.raioMetros;
  if (dentroPerimetro) return { situacao: "aceita", motivo: "dentro_perimetro", dentroPerimetro, distanciaMetros: distancia };
  return {
    situacao: setor.politicaForaPerimetro === "pendente_analise" ? "pendente_analise" : "recusada",
    motivo: "fora_perimetro",
    dentroPerimetro,
    distanciaMetros: distancia,
  };
}

module.exports = { tiposMarcacao, origensMarcacao, MAX_DESVIO_SEGUNDOS, distanciaMetros, classificarMarcacao };

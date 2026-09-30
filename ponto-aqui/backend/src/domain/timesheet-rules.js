const { projetarEscala } = require("./schedule-rules");

const DAY_MS = 24 * 60 * 60 * 1000;

function dataUtc(valor) {
  const texto = valor instanceof Date ? valor.toISOString() : valor;
  const data = new Date(/^\d{4}-\d{2}-\d{2}$/.test(texto) ? `${texto}T00:00:00.000Z` : texto);
  return Number.isFinite(data.getTime()) ? data : null;
}

function minutosEntre(inicio, fim) {
  return Math.max(0, Math.round((fim.getTime() - inicio.getTime()) / 60000));
}

function minutosMarcados(marcacoes) {
  let inicio = null;
  let minutos = 0;
  for (const marcacao of marcacoes) {
    const hora = dataUtc(marcacao.horaServidor);
    if (!hora) continue;
    if (marcacao.tipo === "entrada" || marcacao.tipo === "retorno_intervalo") {
      inicio = hora;
    } else if ((marcacao.tipo === "saida_intervalo" || marcacao.tipo === "saida") && inicio) {
      minutos += minutosEntre(inicio, hora);
      inicio = null;
    }
  }
  return minutos;
}

function calcularEspelho({ inicio, fim, alocacoes, feriados, afastamentos, marcacoes }) {
  const dataInicio = dataUtc(inicio);
  const dataFim = dataUtc(fim);
  if (!dataInicio || !dataFim || dataFim < dataInicio) throw new Error("Período inválido.");
  const dias = Math.floor((dataFim.getTime() - dataInicio.getTime()) / DAY_MS) + 1;
  if (dias > 366) throw new Error("O período máximo do espelho é de 366 dias.");

  return Array.from({ length: dias }, (_, indice) => {
    const dia = new Date(dataInicio.getTime() + indice * DAY_MS);
    const proximoDia = new Date(dia.getTime() + DAY_MS);
    const alocacao = alocacoes.find((item) => item.vigenciaInicio <= dia && (!item.vigenciaFim || item.vigenciaFim >= dia));
    const feriado = feriados.find((item) =>
      dataUtc(item.data)?.toISOString().slice(0, 10) === dia.toISOString().slice(0, 10) &&
      (item.setorId == null || item.setorId === alocacao?.setorId));
    const afastamento = afastamentos.find((item) => item.dataInicio <= proximoDia && item.dataFim >= dia);
    const doDia = marcacoes.filter((item) => item.horaServidor >= dia && item.horaServidor < proximoDia);
    const turnos = alocacao ? projetarEscala({ modelo: alocacao.escala.modelo, dataReferencia: alocacao.escala.dataReferencia, dataInicio: dia, dias: 1, turnos: alocacao.escala.turnos })[0].turnos : [];
    const previsto = turnos.reduce((total, turno) => total + minutosEntre(dataUtc(turno.inicio), dataUtc(turno.fim)), 0);
    const realizado = minutosMarcados(doDia);
    const abonado = Boolean(feriado || afastamento);
    return {
      data: dia.toISOString().slice(0, 10),
      status: feriado ? "feriado" : afastamento ? "afastamento" : alocacao ? "trabalho" : "sem_alocacao",
      descricaoAbono: feriado?.descricao || afastamento?.tipo || null,
      previstoMinutos: abonado ? 0 : previsto,
      realizadoMinutos: realizado,
      saldoMinutos: abonado ? realizado : realizado - previsto,
      marcacoes: doDia,
    };
  });
}

module.exports = { calcularEspelho };

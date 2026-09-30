const test = require("node:test");
const assert = require("node:assert/strict");
const { distanciaMetros, classificarMarcacao } = require("../src/domain/marking-rules");

const setor = {
  latitude: -23.5505,
  longitude: -46.6333,
  raioMetros: 100,
  ignoraLocalizacao: false,
  exigeSelfie: false,
  politicaForaPerimetro: "bloquear",
};

test("calcula distância próxima de zero", () => {
  assert.ok(distanciaMetros(setor.latitude, setor.longitude, setor.latitude, setor.longitude) < 0.001);
});

test("aceita marcação dentro do perímetro", () => {
  const resultado = classificarMarcacao({ setor, latitude: setor.latitude, longitude: setor.longitude, desvioServidorSegundos: 0 });
  assert.equal(resultado.situacao, "aceita");
});

test("manda fora do perímetro para análise quando a política permite", () => {
  const resultado = classificarMarcacao({
    setor: { ...setor, politicaForaPerimetro: "pendente_analise" },
    latitude: -22,
    longitude: -45,
    desvioServidorSegundos: 0,
  });
  assert.equal(resultado.situacao, "pendente_analise");
});

test("recusa selfie ausente quando exigida", () => {
  const resultado = classificarMarcacao({ setor: { ...setor, exigeSelfie: true }, desvioServidorSegundos: 0 });
  assert.equal(resultado.situacao, "recusada");
  assert.equal(resultado.motivo, "selfie_obrigatoria");
});

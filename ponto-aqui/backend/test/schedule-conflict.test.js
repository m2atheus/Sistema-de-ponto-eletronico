const test = require("node:test");
const assert = require("node:assert/strict");
const { encontrarConflitos } = require("../src/domain/schedule-conflict");

function escala(nome, inicio, fim) {
  return {
    id: nome,
    nome,
    modelo: "diurno",
    dataReferencia: null,
    turnos: [{ diaSemana: 1, horaInicio: inicio, horaFim: fim, intervaloMinutos: 0 }],
  };
}

test("detecta conflito de jornada entre setores", () => {
  const conflitos = encontrarConflitos({
    setorId: "setor-b",
    escalaId: "escala-b",
    vigenciaInicio: "2026-01-01",
    vigenciaFim: null,
    escala: escala("Nova", "16:00", "18:00"),
  }, [{
    id: "alocacao-a",
    setorId: "setor-a",
    escalaId: "escala-a",
    vigenciaInicio: "2026-01-01",
    vigenciaFim: null,
    escala: escala("Existente", "08:00", "17:00"),
  }]);

  assert.ok(conflitos.length > 0);
  assert.equal(conflitos[0].escala, "Existente");
});

test("permite jornadas contíguas", () => {
  const conflitos = encontrarConflitos({
    setorId: "setor-b",
    escalaId: "escala-b",
    vigenciaInicio: "2026-01-01",
    vigenciaFim: null,
    escala: escala("Nova", "17:00", "19:00"),
  }, [{
    id: "alocacao-a",
    setorId: "setor-a",
    escalaId: "escala-a",
    vigenciaInicio: "2026-01-01",
    vigenciaFim: null,
    escala: escala("Existente", "08:00", "17:00"),
  }]);

  assert.equal(conflitos.length, 0);
});

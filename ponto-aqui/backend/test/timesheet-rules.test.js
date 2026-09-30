const test = require("node:test");
const assert = require("node:assert/strict");
const { calcularEspelho } = require("../src/domain/timesheet-rules");

const escala = {
  modelo: "diurno",
  dataReferencia: null,
  turnos: [{ diaSemana: 1, horaInicio: "08:00", horaFim: "17:00", intervaloMinutos: 60 }],
};

test("abona feriado e preserva o histórico de marcações", () => {
  const dias = calcularEspelho({
    inicio: "2026-01-05",
    fim: "2026-01-05",
    alocacoes: [{ setorId: "setor-1", vigenciaInicio: new Date("2026-01-01T00:00:00Z"), vigenciaFim: null, escala }],
    feriados: [{ data: new Date("2026-01-05T00:00:00Z"), descricao: "Feriado" }],
    afastamentos: [],
    marcacoes: [],
  });

  assert.equal(dias[0].status, "feriado");
  assert.equal(dias[0].previstoMinutos, 0);
});

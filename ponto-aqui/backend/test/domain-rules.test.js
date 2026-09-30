const test = require("node:test");
const assert = require("node:assert/strict");
const { datasSobrepostas, intervaloValido } = require("../src/domain/allocation-rules");
const { duracaoTurnoMinutos, projetarEscala, validarTurnos } = require("../src/domain/schedule-rules");

test("vigências separadas não se sobrepõem", () => {
  assert.equal(datasSobrepostas("2026-01-01", "2026-01-10", "2026-01-11", null), false);
});

test("limite de vigência compartilhado não é sobreposição", () => {
  assert.equal(datasSobrepostas("2026-01-01", "2026-01-10", "2026-01-10", "2026-01-20"), false);
});

test("vigência sem data final se estende indefinidamente", () => {
  assert.equal(datasSobrepostas("2026-01-01", null, "2026-12-01", "2026-12-31"), true);
});

test("rejeita intervalo com fim anterior ao início", () => {
  assert.equal(intervaloValido("2026-01-10", "2026-01-09"), false);
  assert.equal(intervaloValido("2026-01-10", null), true);
});

test("calcula turno noturno atravessando meia-noite", () => {
  assert.equal(duracaoTurnoMinutos("19:00", "07:00"), 12 * 60);
});

test("calcula turno de 24 horas quando início e fim coincidem", () => {
  assert.equal(duracaoTurnoMinutos("08:00", "08:00"), 24 * 60);
});

test("projeta ciclo 24x72 usando data de referência", () => {
  const dias = projetarEscala({
    modelo: "ciclo_24x72",
    dataReferencia: "2026-01-01",
    dataInicio: "2026-01-01",
    dias: 5,
    turnos: [{ horaInicio: "08:00", horaFim: "08:00", intervaloMinutos: 0 }],
  });
  assert.deepEqual(dias.map((dia) => dia.trabalha), [true, true, false, false, true]);
});

test("rejeita turno incompatível com ciclo 12x36", () => {
  assert.match(validarTurnos("ciclo_12x36", [{ horaInicio: "07:00", horaFim: "18:00", intervaloMinutos: 0 }]), /duração/);
});

test("escala comercial 5x2 precisa cobrir os cinco dias úteis", () => {
  const diasUteis = [1, 2, 3, 4, 5].map((diaSemana) => ({
    diaSemana,
    horaInicio: "08:00",
    horaFim: "17:00",
    intervaloMinutos: 60,
  }));
  assert.equal(validarTurnos("comercial_5x2", diasUteis), null);
  assert.match(validarTurnos("comercial_5x2", diasUteis.slice(0, 4)), /segunda a sexta/);
});
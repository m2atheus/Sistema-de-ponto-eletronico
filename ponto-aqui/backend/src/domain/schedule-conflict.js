const DAY_MS = 24 * 60 * 60 * 1000;
const { projetarEscala } = require("./schedule-rules");

function dataUtc(valor) {
  const texto = valor instanceof Date ? valor.toISOString() : valor;
  const data = new Date(/^\d{4}-\d{2}-\d{2}$/.test(texto) ? `${texto}T00:00:00.000Z` : texto);
  return Number.isFinite(data.getTime()) ? data : null;
}

function intervaloAberto(inicio, fim) {
  const a = dataUtc(inicio);
  const b = fim == null ? null : dataUtc(fim);
  return a && (!fim || b) ? { inicio: a, fim: b } : null;
}

function interseccao(a, b) {
  const inicio = new Date(Math.max(a.inicio.getTime(), b.inicio.getTime()));
  const fimMs = Math.min(
    a.fim ? a.fim.getTime() : Infinity,
    b.fim ? b.fim.getTime() : Infinity,
  );
  const fim = Number.isFinite(fimMs) ? new Date(fimMs) : null;
  return !fim || inicio < fim ? { inicio, fim } : null;
}

function projetarIntervalos(alocacao, janela) {
  const vigencia = intervaloAberto(alocacao.vigenciaInicio, alocacao.vigenciaFim);
  const comum = vigencia && interseccao(vigencia, janela);
  if (!comum) return [];

  const inicio = comum.inicio;
  const fim = comum.fim || new Date(inicio.getTime() + 365 * DAY_MS);
  const dias = Math.min(365, Math.ceil((fim.getTime() - inicio.getTime()) / DAY_MS) + 2);
  const projecao = projetarEscala({
    modelo: alocacao.escala.modelo,
    dataReferencia: alocacao.escala.dataReferencia,
    dataInicio: inicio,
    dias,
    turnos: alocacao.escala.turnos,
  });

  return projecao.flatMap((dia) => dia.turnos)
    .map((turno) => ({ inicio: dataUtc(turno.inicio), fim: dataUtc(turno.fim) }))
    .filter((turno) => turno.inicio && turno.fim && turno.inicio < fim && turno.fim > inicio)
    .map((turno) => ({
      inicio: new Date(Math.max(turno.inicio.getTime(), inicio.getTime())),
      fim: new Date(Math.min(turno.fim.getTime(), fim.getTime())),
    }))
    .filter((turno) => turno.inicio < turno.fim);
}

function intervalosSobrepostos(intervalosA, intervalosB) {
  const conflitos = [];
  for (const a of intervalosA) {
    for (const b of intervalosB) {
      const inicio = new Date(Math.max(a.inicio.getTime(), b.inicio.getTime()));
      const fim = new Date(Math.min(a.fim.getTime(), b.fim.getTime()));
      if (inicio < fim) conflitos.push({ inicio, fim });
    }
  }
  return conflitos;
}

function encontrarConflitos(alocacao, existentes) {
  const janela = intervaloAberto(alocacao.vigenciaInicio, alocacao.vigenciaFim);
  if (!janela) return [];
  const intervalosNovos = projetarIntervalos(alocacao, janela);
  return existentes.flatMap((existente) => {
    const conflitos = intervalosSobrepostos(intervalosNovos, projetarIntervalos(existente, janela));
    return conflitos.map((conflito) => ({
      alocacaoId: existente.id,
      setorId: existente.setorId,
      escalaId: existente.escalaId,
      escala: existente.escala.nome,
      inicio: conflito.inicio.toISOString(),
      fim: conflito.fim.toISOString(),
    }));
  });
}

module.exports = { encontrarConflitos };

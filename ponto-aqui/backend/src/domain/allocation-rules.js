function datasSobrepostas(inicioA, fimA, inicioB, fimB) {
  const aInicio = new Date(inicioA).getTime();
  const bInicio = new Date(inicioB).getTime();
  const aFim = fimA == null ? Infinity : new Date(fimA).getTime();
  const bFim = fimB == null ? Infinity : new Date(fimB).getTime();

  return aInicio <= bFim && bInicio <= aFim;
}

function intervaloValido(inicio, fim) {
  const inicioMs = new Date(inicio).getTime();
  const fimMs = fim == null ? null : new Date(fim).getTime();
  return Number.isFinite(inicioMs) && (fimMs === null || (Number.isFinite(fimMs) && fimMs >= inicioMs));
}

module.exports = { datasSobrepostas, intervaloValido };
const prisma = require("../config/prisma");
const { calcularEspelho } = require("../domain/timesheet-rules");

async function obter(req, res) {
  const usuarioId = req.perfil === "funcionario" ? req.usuarioId : req.query.usuarioId;
  const inicio = req.query.inicio;
  const fim = req.query.fim;
  if (!usuarioId || !inicio || !fim) return res.status(400).json({ erro: "periodo_e_usuario_obrigatorios" });
  const usuario = await prisma.usuario.findFirst({ where: { id: usuarioId, empresaId: req.empresaId }, select: { id: true } });
  if (!usuario) return res.status(404).json({ erro: "usuario_nao_encontrado" });
  const dataInicio = new Date(`${inicio}T00:00:00.000Z`);
  const dataFim = new Date(`${fim}T23:59:59.999Z`);
  if (!Number.isFinite(dataInicio.getTime()) || !Number.isFinite(dataFim.getTime())) return res.status(400).json({ erro: "periodo_invalido" });
  const [alocacoes, feriados, afastamentos, marcacoes] = await Promise.all([
    prisma.funcionarioSetor.findMany({ where: { usuarioId, empresaId }, include: { escala: { include: { turnos: true } } } }),
    prisma.feriado.findMany({ where: { empresaId, data: { gte: dataInicio, lte: dataFim } } }),
    prisma.afastamento.findMany({ where: { empresaId, usuarioId, dataFim: { gte: dataInicio }, dataInicio: { lte: dataFim } } }),
    prisma.marcacao.findMany({ where: { empresaId, usuarioId, horaServidor: { gte: dataInicio, lte: dataFim }, situacao: { not: "recusada" } }, orderBy: { horaServidor: "asc" } }),
  ]);
  try {
    const dias = calcularEspelho({ inicio, fim, alocacoes, feriados, afastamentos, marcacoes });
    return res.json({ usuarioId, inicio, fim, dias });
  } catch (error) {
    return res.status(400).json({ erro: "periodo_invalido", mensagem: error.message });
  }
}

module.exports = { obter };

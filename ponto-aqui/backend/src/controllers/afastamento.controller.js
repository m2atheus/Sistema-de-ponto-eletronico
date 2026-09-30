const prisma = require("../config/prisma");
const { datasSobrepostas, intervaloValido } = require("../domain/allocation-rules");

function empresaIdDaRequisicao(req) {
  return req.perfil === "superadmin" ? req.query.empresaId || req.body.empresaId || null : req.empresaId;
}

function dataValida(valor) {
  const data = new Date(valor);
  return Number.isFinite(data.getTime()) ? data : null;
}

function fimInclusivo(data) {
  return new Date(data.getTime() + 24 * 60 * 60 * 1000);
}

async function listar(req, res) {
  const empresaId = empresaIdDaRequisicao(req);
  if (!empresaId) return res.status(400).json({ erro: "empresa_obrigatoria" });
  const afastamentos = await prisma.afastamento.findMany({
    where: { empresaId, ...(req.query.usuarioId ? { usuarioId: req.query.usuarioId } : {}) },
    include: { usuario: { select: { id: true, nome: true, matricula: true } } },
    orderBy: { dataInicio: "desc" },
  });
  return res.json({ afastamentos });
}

async function criar(req, res) {
  const empresaId = empresaIdDaRequisicao(req);
  const { usuarioId, tipo } = req.body;
  const dataInicio = dataValida(req.body.dataInicio);
  const dataFim = dataValida(req.body.dataFim);
  if (!empresaId || !usuarioId || typeof tipo !== "string" || !tipo.trim() || !dataInicio || !dataFim || !intervaloValido(dataInicio, dataFim)) {
    return res.status(400).json({ erro: "dados_invalidos", mensagem: "Funcionário, tipo e intervalo válido são obrigatórios." });
  }

  const usuario = await prisma.usuario.findFirst({ where: { id: usuarioId, empresaId, perfil: "funcionario" }, select: { id: true } });
  if (!usuario) return res.status(404).json({ erro: "funcionario_nao_encontrado" });
  const afastamentos = await prisma.afastamento.findMany({ where: { empresaId, usuarioId }, select: { dataInicio: true, dataFim: true } });
  const fimComparacao = fimInclusivo(dataFim);
  if (afastamentos.some((item) => datasSobrepostas(item.dataInicio, fimInclusivo(item.dataFim), dataInicio, fimComparacao))) {
    return res.status(409).json({ erro: "afastamento_sobreposto", mensagem: "Já existe afastamento deste funcionário nesse período." });
  }

  const afastamento = await prisma.afastamento.create({
    data: { empresaId, usuarioId, tipo: tipo.trim(), dataInicio, dataFim, anexoUrl: req.body.anexoUrl || null },
    include: { usuario: { select: { id: true, nome: true, matricula: true } } },
  });
  return res.status(201).json({ afastamento });
}

async function excluir(req, res) {
  const empresaId = empresaIdDaRequisicao(req);
  const afastamento = await prisma.afastamento.findFirst({ where: { id: req.params.id, ...(empresaId ? { empresaId } : {}) } });
  if (!afastamento) return res.status(404).json({ erro: "afastamento_nao_encontrado" });
  await prisma.afastamento.delete({ where: { id: afastamento.id } });
  return res.status(204).end();
}

module.exports = { listar, criar, excluir };

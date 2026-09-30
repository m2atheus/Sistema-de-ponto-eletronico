const prisma = require("../config/prisma");

function empresaIdDaRequisicao(req) {
  return req.perfil === "superadmin" ? req.query.empresaId || req.body.empresaId || null : req.empresaId;
}

function dataValida(valor) {
  const data = new Date(valor);
  return Number.isFinite(data.getTime()) ? data : null;
}

async function listar(req, res) {
  const empresaId = empresaIdDaRequisicao(req);
  if (!empresaId) return res.status(400).json({ erro: "empresa_obrigatoria" });
  const feriados = await prisma.feriado.findMany({
    where: { empresaId },
    include: { setor: { select: { id: true, nome: true } } },
    orderBy: [{ data: "asc" }, { descricao: "asc" }],
  });
  return res.json({ feriados });
}

async function criar(req, res) {
  const empresaId = empresaIdDaRequisicao(req);
  const data = dataValida(req.body.data);
  const descricao = typeof req.body.descricao === "string" ? req.body.descricao.trim() : "";
  const setorId = req.body.setorId || null;
  if (!empresaId || !data || !descricao) return res.status(400).json({ erro: "dados_invalidos" });

  if (setorId) {
    const setor = await prisma.setor.findFirst({ where: { id: setorId, empresaId }, select: { id: true } });
    if (!setor) return res.status(404).json({ erro: "setor_nao_encontrado" });
  }
  const existente = await prisma.feriado.findFirst({ where: { empresaId, setorId, data } });
  if (existente) return res.status(409).json({ erro: "feriado_duplicado" });
  const feriado = await prisma.feriado.create({ data: { empresaId, setorId, data, descricao } });
  return res.status(201).json({ feriado });
}

async function excluir(req, res) {
  const empresaId = empresaIdDaRequisicao(req);
  const feriado = await prisma.feriado.findFirst({ where: { id: req.params.id, ...(empresaId ? { empresaId } : {}) } });
  if (!feriado) return res.status(404).json({ erro: "feriado_nao_encontrado" });
  await prisma.feriado.delete({ where: { id: feriado.id } });
  return res.status(204).end();
}

module.exports = { listar, criar, excluir };

const prisma = require("../config/prisma");
const usuarios = require("./usuario.controller");
const { datasSobrepostas, intervaloValido } = require("../domain/allocation-rules");
const { encontrarConflitos } = require("../domain/schedule-conflict");

function empresaIdDaRequisicao(req) {
  return req.perfil === "superadmin"
    ? req.query.empresaId || req.params.empresaId || req.body.empresaId || null
    : req.empresaId;
}

function tratarErro(res, error) {
  if (error.code === "P2002") {
    return res.status(409).json({ erro: "matricula_duplicada", mensagem: "Já existe funcionário com essa matrícula nesta empresa." });
  }
  if (error.code === "P2025") return res.status(404).json({ erro: "registro_nao_encontrado" });
  return res.status(500).json({ erro: "erro_interno" });
}

async function listar(req, res) {
  const empresaId = empresaIdDaRequisicao(req);
  if (!empresaId) return res.status(400).json({ erro: "empresa_obrigatoria" });
  try {
    const funcionarios = await prisma.usuario.findMany({
      where: { empresaId, perfil: "funcionario" },
      select: {
        id: true, empresaId: true, nome: true, email: true, login: true,
        matricula: true, cargo: true, ativo: true, criadoEm: true,
      },
      orderBy: { nome: "asc" },
    });
    return res.json({ funcionarios });
  } catch (error) {
    return tratarErro(res, error);
  }
}

async function criar(req, res) {
  req.body = { ...req.body, perfil: "funcionario" };
  return usuarios.criar(req, res);
}

async function listarAlocacoes(req, res) {
  const empresaId = empresaIdDaRequisicao(req);
  try {
    const funcionario = await prisma.usuario.findFirst({
      where: {
        id: req.params.id,
        perfil: "funcionario",
        ...(empresaId ? { empresaId } : {}),
      },
      select: { id: true },
    });
    if (!funcionario) return res.status(404).json({ erro: "funcionario_nao_encontrado" });

    const alocacoes = await prisma.funcionarioSetor.findMany({
      where: { usuarioId: funcionario.id, ...(empresaId ? { empresaId } : {}) },
      include: {
        setor: { select: { id: true, nome: true, endereco: true } },
        escala: { select: { id: true, nome: true, tipo: true } },
      },
      orderBy: { vigenciaInicio: "desc" },
    });
    return res.json({ alocacoes });
  } catch (error) {
    return tratarErro(res, error);
  }
}

async function listarPorSetor(req, res) {
  const empresaId = empresaIdDaRequisicao(req);
  if (!empresaId) return res.status(400).json({ erro: "empresa_obrigatoria" });
  const agora = new Date();
  try {
    const setor = await prisma.setor.findFirst({
      where: { id: req.params.setorId, empresaId },
      select: { id: true },
    });
    if (!setor) return res.status(404).json({ erro: "setor_nao_encontrado" });

    const alocacoes = await prisma.funcionarioSetor.findMany({
      where: {
        empresaId,
        setorId: setor.id,
        vigenciaInicio: { lte: agora },
        OR: [{ vigenciaFim: null }, { vigenciaFim: { gte: agora } }],
      },
      include: {
        usuario: { select: { id: true, nome: true, email: true, matricula: true, cargo: true, ativo: true } },
        escala: { select: { id: true, nome: true } },
      },
      orderBy: { usuario: { nome: "asc" } },
    });
    return res.json({ funcionarios: alocacoes.map((a) => ({ ...a.usuario, alocacaoId: a.id, escala: a.escala })) });
  } catch (error) {
    return tratarErro(res, error);
  }
}

async function criarAlocacao(req, res) {
  const empresaId = empresaIdDaRequisicao(req);
  const { setorId, escalaId } = req.body;
  const inicio = new Date(req.body.vigenciaInicio);
  const fim = req.body.vigenciaFim == null ? null : new Date(req.body.vigenciaFim);
  if (!empresaId || !setorId || !escalaId || !intervaloValido(inicio, fim)) {
    return res.status(400).json({ erro: "dados_invalidos", mensagem: "Empresa, setor, escala e vigência válida são obrigatórios." });
  }

  try {
    const [funcionario, setor, escala] = await Promise.all([
      prisma.usuario.findFirst({ where: { id: req.params.id, empresaId, perfil: "funcionario", ativo: true }, select: { id: true } }),
      prisma.setor.findFirst({ where: { id: setorId, empresaId }, select: { id: true } }),
      prisma.escala.findFirst({
        where: { id: escalaId, empresaId, setorId },
        include: { turnos: true },
      }),
    ]);
    if (!funcionario) return res.status(404).json({ erro: "funcionario_nao_encontrado" });
    if (!setor) return res.status(404).json({ erro: "setor_nao_encontrado" });
    if (!escala) return res.status(404).json({ erro: "escala_nao_encontrada_para_setor" });

    const alocacoesMesmoSetor = await prisma.funcionarioSetor.findMany({
      where: { empresaId, usuarioId: funcionario.id, setorId },
      select: { vigenciaInicio: true, vigenciaFim: true },
    });
    if (alocacoesMesmoSetor.some((a) => datasSobrepostas(a.vigenciaInicio, a.vigenciaFim, inicio, fim))) {
      return res.status(409).json({ erro: "alocacao_sobreposta", mensagem: "Já existe alocação deste funcionário para o setor nesse período." });
    }

    const alocacoesExistentes = await prisma.funcionarioSetor.findMany({
      where: { empresaId, usuarioId: funcionario.id },
      include: { escala: { include: { turnos: true } } },
    });
    const conflitos = encontrarConflitos({
      id: null,
      setorId,
      escalaId,
      vigenciaInicio: inicio,
      vigenciaFim: fim,
      escala: { ...escala, turnos: escala.turnos || [] },
    }, alocacoesExistentes);
    if (conflitos.length) {
      return res.status(409).json({
        erro: "conflito_de_escala",
        mensagem: "A jornada projetada conflita com outra escala deste funcionário.",
        conflitos,
      });
    }

    const alocacao = await prisma.funcionarioSetor.create({
      data: { empresaId, usuarioId: funcionario.id, setorId, escalaId, vigenciaInicio: inicio, vigenciaFim: fim },
      include: { setor: true, escala: true },
    });
    return res.status(201).json({ alocacao });
  } catch (error) {
    return tratarErro(res, error);
  }
}

async function encerrarAlocacao(req, res) {
  const empresaId = empresaIdDaRequisicao(req);
  const fim = req.body.vigenciaFim ? new Date(req.body.vigenciaFim) : new Date();
  try {
    const alocacao = await prisma.funcionarioSetor.findFirst({
      where: { id: req.params.alocacaoId, ...(empresaId ? { empresaId } : {}) },
    });
    if (!alocacao) return res.status(404).json({ erro: "alocacao_nao_encontrada" });
    if (alocacao.vigenciaFim) return res.status(409).json({ erro: "alocacao_ja_encerrada" });
    if (!intervaloValido(alocacao.vigenciaInicio, fim)) return res.status(400).json({ erro: "vigencia_invalida" });

    const atualizada = await prisma.funcionarioSetor.update({
      where: { id: alocacao.id },
      data: { vigenciaFim: fim },
    });
    return res.json({ alocacao: atualizada });
  } catch (error) {
    return tratarErro(res, error);
  }
}

module.exports = { listar, criar, listarAlocacoes, listarPorSetor, criarAlocacao, encerrarAlocacao };
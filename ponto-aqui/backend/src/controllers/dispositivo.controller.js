const prisma = require("../config/prisma");
const bcrypt = require("bcryptjs");

const tipos = new Set(["pessoal", "modo_relogio"]);
const status = new Set(["ativo", "aguardando", "bloqueado"]);

function empresaIdDaRequisicao(req) {
  return req.perfil === "superadmin" ? req.query.empresaId || req.body.empresaId || null : req.empresaId;
}

async function listar(req, res) {
  const empresaId = empresaIdDaRequisicao(req);
  if (!empresaId) return res.status(400).json({ erro: "empresa_obrigatoria" });
  const dispositivos = await prisma.dispositivo.findMany({
    where: { empresaId },
    include: {
      usuario: { select: { id: true, nome: true, email: true, perfil: true } },
      setor: { select: { id: true, nome: true } },
    },
    orderBy: { ultimoLoginEm: "desc" },
  });
  return res.json({ dispositivos });
}

async function criar(req, res) {
  const empresaId = empresaIdDaRequisicao(req);
  const identificador = typeof req.body.identificador === "string" ? req.body.identificador.trim() : "";
  const tipo = req.body.tipo;
  const usuarioId = req.body.usuarioId || null;
  const setorId = req.body.setorId || null;
  if (!empresaId || !identificador || !tipos.has(tipo)) return res.status(400).json({ erro: "dados_invalidos" });
  if (tipo === "pessoal" && (!usuarioId || setorId)) return res.status(400).json({ erro: "vinculo_invalido", mensagem: "Dispositivo pessoal exige funcionário e não pode ser vinculado a setor." });
  if (tipo === "modo_relogio" && (!setorId || !usuarioId)) return res.status(400).json({ erro: "vinculo_invalido", mensagem: "Dispositivo relógio exige setor e usuário do setor." });

  const [usuario, setor] = await Promise.all([
    usuarioId ? prisma.usuario.findFirst({ where: { id: usuarioId, empresaId }, select: { id: true, perfil: true } }) : null,
    setorId ? prisma.setor.findFirst({ where: { id: setorId, empresaId }, select: { id: true } }) : null,
  ]);
  if (usuarioId && !usuario) return res.status(404).json({ erro: "usuario_nao_encontrado" });
  if (tipo === "modo_relogio" && usuario.perfil !== "usuario_setor") return res.status(400).json({ erro: "perfil_invalido", mensagem: "Relógio deve usar uma conta de usuário do setor." });
  if (setorId && !setor) return res.status(404).json({ erro: "setor_nao_encontrado" });

  try {
    const dispositivo = await prisma.dispositivo.create({
      data: { empresaId, identificador, tipo, usuarioId, setorId, status: req.body.status && status.has(req.body.status) ? req.body.status : "aguardando" },
      include: { usuario: { select: { id: true, nome: true, perfil: true } }, setor: { select: { id: true, nome: true } } },
    });
    return res.status(201).json({ dispositivo });
  } catch (error) {
    if (error.code === "P2002") return res.status(409).json({ erro: "dispositivo_duplicado" });
    return res.status(500).json({ erro: "erro_interno" });
  }
}

async function atualizar(req, res) {
  const empresaId = empresaIdDaRequisicao(req);
  const novoStatus = req.body.status;
  if (!status.has(novoStatus)) return res.status(400).json({ erro: "status_invalido" });
  const dispositivo = await prisma.dispositivo.findFirst({ where: { id: req.params.id, ...(empresaId ? { empresaId } : {}) } });
  if (!dispositivo) return res.status(404).json({ erro: "dispositivo_nao_encontrado" });
  const atualizado = await prisma.dispositivo.update({ where: { id: dispositivo.id }, data: { status: novoStatus } });
  return res.json({ dispositivo: atualizado });
}

async function trocarModo(req, res) {
  const dispositivo = await prisma.dispositivo.findFirst({ where: { id: req.params.id, empresaId: req.empresaId } });
  if (!dispositivo) return res.status(404).json({ erro: "dispositivo_nao_encontrado" });
  const senhaGestor = req.body.senhaGestor;
  const gestor = await prisma.usuario.findFirst({ where: { empresaId: req.empresaId, perfil: "gestor", ativo: true } });
  if (!gestor || typeof senhaGestor !== "string" || !(await bcrypt.compare(senhaGestor, gestor.senhaHash))) {
    return res.status(403).json({ erro: "senha_gestor_invalida" });
  }
  const tipo = req.body.tipo;
  const usuarioId = req.body.usuarioId || null;
  const setorId = req.body.setorId || null;
  if (!tipos.has(tipo)) return res.status(400).json({ erro: "tipo_invalido" });
  if (tipo === "pessoal" && (!usuarioId || setorId)) return res.status(400).json({ erro: "vinculo_invalido" });
  if (tipo === "modo_relogio" && (!usuarioId || !setorId)) return res.status(400).json({ erro: "vinculo_invalido" });
  const usuario = await prisma.usuario.findFirst({ where: { id: usuarioId, empresaId: req.empresaId, ativo: true } });
  const setor = setorId ? await prisma.setor.findFirst({ where: { id: setorId, empresaId: req.empresaId }, select: { id: true } }) : null;
  if (!usuario || !setor && tipo === "modo_relogio") return res.status(404).json({ erro: "vinculo_nao_encontrado" });
  if (tipo === "modo_relogio" && usuario.perfil !== "usuario_setor") return res.status(400).json({ erro: "perfil_invalido" });
  const atualizado = await prisma.dispositivo.update({ where: { id: dispositivo.id }, data: { tipo, usuarioId, setorId, status: "ativo" } });
  return res.json({ dispositivo: atualizado });
}

module.exports = { listar, criar, atualizar, trocarModo };

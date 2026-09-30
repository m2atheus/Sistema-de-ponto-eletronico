const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");

const perfis = {
  superadmin: "superadmin",
  superadministrador: "superadmin",
  rh: "rh",
  administrador: "rh",
  "rh/administrador": "rh",
  gestor: "gestor",
  funcionario: "funcionario",
  "funcionário": "funcionario",
  usuario_setor: "usuario_setor",
  "usuário do setor": "usuario_setor",
};

const camposPublicos = {
  id: true,
  empresaId: true,
  nome: true,
  email: true,
  login: true,
  matricula: true,
  cargo: true,
  perfil: true,
  ativo: true,
  criadoEm: true,
};

function tratarErro(res, error) {
  if (error.code === "P2002") {
    return res.status(409).json({ erro: "usuario_duplicado", mensagem: "Usuário, e-mail ou matrícula já cadastrado." });
  }
  if (error.code === "P2025") return res.status(404).json({ erro: "usuario_nao_encontrado" });
  return res.status(500).json({ erro: "erro_interno" });
}

function perfilDoBody(valor) {
  return typeof valor === "string" ? perfis[valor.trim().toLowerCase()] : undefined;
}

async function listar(req, res) {
  const empresaId = req.perfil === "superadmin" ? req.query.empresaId : req.empresaId;
  if (req.perfil !== "superadmin" && !empresaId) return res.status(403).json({ erro: "empresa_obrigatoria" });

  try {
    const usuarios = await prisma.usuario.findMany({
      where: empresaId ? { empresaId } : undefined,
      select: camposPublicos,
      orderBy: { nome: "asc" },
    });
    return res.json({ usuarios });
  } catch (error) {
    return tratarErro(res, error);
  }
}

async function obter(req, res) {
  try {
    const usuario = await prisma.usuario.findFirst({
      where: {
        id: req.params.id,
        ...(req.perfil === "superadmin" ? {} : { empresaId: req.empresaId }),
      },
      select: camposPublicos,
    });
    if (!usuario) return res.status(404).json({ erro: "usuario_nao_encontrado" });
    return res.json({ usuario });
  } catch (error) {
    return tratarErro(res, error);
  }
}

async function criar(req, res) {
  const nome = typeof req.body.nome === "string" ? req.body.nome.trim() : "";
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const login = (req.body.login || req.body.usuario || email).trim().toLowerCase();
  const senha = req.body.senha;
  const perfil = perfilDoBody(req.body.perfil);
  const superadmin = req.perfil === "superadmin";
  const empresaId = superadmin ? (req.body.empresaId || null) : req.empresaId;

  if (!nome || !email || !login || typeof senha !== "string" || senha.length < 8 || !perfil) {
    return res.status(400).json({ erro: "dados_invalidos", mensagem: "Informe nome, e-mail, usuário, senha (mínimo 8 caracteres) e perfil válido." });
  }
  if (perfil === "superadmin" && !superadmin) return res.status(403).json({ erro: "permissao_negada" });
  if ((perfil === "superadmin") !== (empresaId === null)) {
    return res.status(400).json({ erro: "vinculo_empresa_invalido" });
  }

  try {
    if (empresaId) {
      const empresa = await prisma.empresa.findUnique({ where: { id: empresaId }, select: { id: true } });
      if (!empresa) return res.status(404).json({ erro: "empresa_nao_encontrada" });
    }
    const usuario = await prisma.usuario.create({
      data: {
        nome,
        email,
        login,
        senhaHash: await bcrypt.hash(senha, 12),
        perfil,
        empresaId,
        matricula: typeof req.body.matricula === "string" ? req.body.matricula.trim() || null : null,
        cargo: typeof req.body.cargo === "string" ? req.body.cargo.trim() || null : null,
        ativo: typeof req.body.ativo === "boolean" ? req.body.ativo : true,
      },
      select: camposPublicos,
    });
    return res.status(201).json({ usuario });
  } catch (error) {
    return tratarErro(res, error);
  }
}

async function atualizar(req, res) {
  const where = {
    id: req.params.id,
    ...(req.perfil === "superadmin" ? {} : { empresaId: req.empresaId }),
  };

  try {
    const existente = await prisma.usuario.findFirst({ where, select: { id: true, perfil: true, empresaId: true } });
    if (!existente) return res.status(404).json({ erro: "usuario_nao_encontrado" });

    const data = {};
    if (typeof req.body.nome === "string" && req.body.nome.trim()) data.nome = req.body.nome.trim();
    if (typeof req.body.email === "string" && req.body.email.trim()) data.email = req.body.email.trim().toLowerCase();
    if (typeof req.body.login === "string" && req.body.login.trim()) data.login = req.body.login.trim().toLowerCase();
    if (typeof req.body.matricula === "string") data.matricula = req.body.matricula.trim() || null;
    if (typeof req.body.cargo === "string") data.cargo = req.body.cargo.trim() || null;
    if (typeof req.body.ativo === "boolean") data.ativo = req.body.ativo;
    if (typeof req.body.senha === "string") {
      if (req.body.senha.length < 8) return res.status(400).json({ erro: "senha_fraca" });
      data.senhaHash = await bcrypt.hash(req.body.senha, 12);
    }

    if (req.body.perfil !== undefined) {
      const perfil = perfilDoBody(req.body.perfil);
      if (!perfil) return res.status(400).json({ erro: "perfil_invalido" });
      if ((perfil === "superadmin" || existente.perfil === "superadmin") && req.perfil !== "superadmin") {
        return res.status(403).json({ erro: "permissao_negada" });
      }
      data.perfil = perfil;
      if (req.perfil === "superadmin" && perfil === "superadmin") data.empresaId = null;
    }

    if (req.perfil === "superadmin" && req.body.empresaId !== undefined) {
      const novoEmpresaId = req.body.empresaId || null;
      if ((data.perfil || existente.perfil) === "superadmin" && novoEmpresaId !== null) {
        return res.status(400).json({ erro: "vinculo_empresa_invalido" });
      }
      if (novoEmpresaId) {
        const empresa = await prisma.empresa.findUnique({ where: { id: novoEmpresaId }, select: { id: true } });
        if (!empresa) return res.status(404).json({ erro: "empresa_nao_encontrada" });
      }
      data.empresaId = novoEmpresaId;
    }

    if (!Object.keys(data).length) return res.status(400).json({ erro: "dados_invalidos" });
    const usuario = await prisma.usuario.update({ where: { id: existente.id }, data, select: camposPublicos });
    return res.json({ usuario });
  } catch (error) {
    return tratarErro(res, error);
  }
}

module.exports = { listar, obter, criar, atualizar };
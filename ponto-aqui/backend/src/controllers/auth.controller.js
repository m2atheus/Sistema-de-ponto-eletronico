const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const JWT_EXPIRACAO = "30d"; // sessão longa: o app decide sozinho quando forçar login de novo

// Tarefa A01 — login com usuário e senha.
// Erro de login é genérico (não diz qual campo falhou) e, ao autenticar,
// qualquer dispositivo anterior do mesmo usuário é desligado (login em
// aparelho novo desloga o antigo).
async function login(req, res) {
  const identificador = req.body.email || req.body.login || req.body.usuario;
  const { senha, identificadorDispositivo } = req.body;

  if (!identificador || !senha || !identificadorDispositivo) {
    return res.status(400).json({ erro: "dados_invalidos" });
  }

  try {
    const usuario = await prisma.usuario.findFirst({
      where: { OR: [{ email: identificador }, { login: identificador }] },
      include: { empresa: true },
    });
    const senhaOk = usuario && (await bcrypt.compare(senha, usuario.senhaHash));

    if (
      !usuario ||
      !senhaOk ||
      !usuario.ativo ||
      (usuario.empresaId && (!usuario.empresa || !usuario.empresa.ativo))
    ) {
      return res.status(401).json({
        erro: "credenciais_invalidas",
        mensagem: "Usuário ou senha inválidos.",
      });
    }

    const dispositivoAnterior = await prisma.dispositivo.findFirst({
      where: { usuarioId: usuario.id, status: "ativo" },
    });

    if (dispositivoAnterior && dispositivoAnterior.identificador !== identificadorDispositivo) {
      await prisma.dispositivo.update({
        where: { id: dispositivoAnterior.id },
        data: { status: "bloqueado" },
      });
    }

    const dispositivo = await prisma.dispositivo.upsert({
      where: { identificador: identificadorDispositivo },
      update: {
        empresaId: usuario.empresaId,
        status: "ativo",
        usuarioId: usuario.id,
        ultimoLoginEm: new Date(),
      },
      create: {
        empresaId: usuario.empresaId,
        usuarioId: usuario.id,
        identificador: identificadorDispositivo,
        tipo: "pessoal",
        status: "ativo",
        ultimoLoginEm: new Date(),
      },
    });

    const token = jwt.sign(
      { usuarioId: usuario.id, empresaId: usuario.empresaId, dispositivoId: dispositivo.id },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRACAO }
    );

    return res.json({
      token,
      expiraEm: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      horaServidor: new Date().toISOString(),
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        login: usuario.login,
        empresaId: usuario.empresaId,
        perfil: usuario.perfil,
      },
    });
  } catch (_err) {
    return res.status(500).json({ erro: "erro_interno" });
  }
}

module.exports = { login };

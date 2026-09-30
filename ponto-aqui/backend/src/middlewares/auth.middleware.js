const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");

async function autenticar(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ erro: "token_ausente" });
  }

  const token = header.replace("Bearer ", "");
  let payload;

  try {
    payload = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
  } catch (_err) {
    return res.status(401).json({ erro: "token_invalido" });
  }

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: payload.usuarioId },
      include: { empresa: true },
    });
    const dispositivo = payload.dispositivoId
      ? await prisma.dispositivo.findUnique({ where: { id: payload.dispositivoId } })
      : null;

    if (
      !usuario ||
      !usuario.ativo ||
      (usuario.empresaId && (!usuario.empresa || !usuario.empresa.ativo)) ||
      usuario.empresaId !== (payload.empresaId ?? null) ||
      !dispositivo ||
      dispositivo.status !== "ativo" ||
      dispositivo.usuarioId !== usuario.id ||
      dispositivo.empresaId !== usuario.empresaId
    ) {
      return res.status(401).json({ erro: "token_invalido" });
    }

    req.usuarioId = usuario.id;
    req.empresaId = usuario.empresaId;
    req.dispositivoId = dispositivo.id;
    req.perfil = usuario.perfil;
    return next();
  } catch (_err) {
    return res.status(500).json({ erro: "erro_interno" });
  }
}

function autorizar(...perfis) {
  return (req, res, next) => {
    if (!perfis.includes(req.perfil)) {
      return res.status(403).json({ erro: "permissao_negada" });
    }
    return next();
  };
}

module.exports = { autenticar, autorizar };

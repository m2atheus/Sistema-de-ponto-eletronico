const jwt = require("jsonwebtoken");

// Valida o token do dispositivo. Token vencido ou de dispositivo desligado
// (ver auth.controller -> login) retorna 401 — o app deve mandar o usuário
// para a tela de login sem perder nenhuma marcação da fila local.
function autenticar(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ erro: "token_ausente" });
  }

  const token = header.replace("Bearer ", "");

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
    req.usuarioId = payload.usuarioId;
    req.empresaId = payload.empresaId;
    req.dispositivoId = payload.dispositivoId;
    next();
  } catch (_err) {
    return res.status(401).json({ erro: "token_invalido" });
  }
}

module.exports = { autenticar };

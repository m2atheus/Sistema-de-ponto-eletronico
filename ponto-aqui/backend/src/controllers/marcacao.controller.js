const prisma = require("../config/prisma");
const { tiposMarcacao, origensMarcacao, classificarMarcacao } = require("../domain/marking-rules");

function dataValida(valor) {
  const data = new Date(valor);
  return Number.isFinite(data.getTime()) ? data : null;
}

async function processarMarcacao(req, marcacao) {
  const recebidoEm = new Date();
  const horaDispositivo = dataValida(marcacao.horaDispositivo);
  const tipoValido = tiposMarcacao.has(marcacao.tipo);
  const origem = marcacao.origem || "offline_sincronizada";
  if (!marcacao.idLocal || typeof marcacao.idLocal !== "string" || !horaDispositivo || !tipoValido || !origensMarcacao.has(origem)) {
    return { idLocal: marcacao.idLocal || null, status: "recusada", motivo: "dados_invalidos" };
  }

  const existente = await prisma.marcacao.findUnique({ where: { idLocal: marcacao.idLocal } });
  if (existente) return { idLocal: marcacao.idLocal, status: "ja_recebida", situacao: existente.situacao, id: existente.id };

  const dispositivo = req.dispositivo;
  const usuarioId = dispositivo.tipo === "modo_relogio" ? marcacao.usuarioId : req.usuarioId;
  const setorId = dispositivo.tipo === "modo_relogio" ? dispositivo.setorId : marcacao.setorId;
  if (!usuarioId || !setorId || (dispositivo.tipo === "modo_relogio" && marcacao.setorId && marcacao.setorId !== setorId)) {
    return { idLocal: marcacao.idLocal, status: "recusada", motivo: "vinculo_dispositivo_invalido" };
  }

  const [usuario, setor] = await Promise.all([
    prisma.usuario.findFirst({ where: { id: usuarioId, empresaId: req.empresaId, ativo: true }, select: { id: true } }),
    prisma.setor.findFirst({ where: { id: setorId, empresaId: req.empresaId } }),
  ]);
  if (!usuario || !setor) return { idLocal: marcacao.idLocal, status: "recusada", motivo: "usuario_ou_setor_invalido" };
  if (dispositivo.tipo === "pessoal" && dispositivo.usuarioId !== usuarioId) {
    return { idLocal: marcacao.idLocal, status: "recusada", motivo: "dispositivo_nao_vinculado" };
  }

  const alocacao = await prisma.funcionarioSetor.findFirst({
    where: {
      usuarioId,
      empresaId: req.empresaId,
      setorId,
      vigenciaInicio: { lte: recebidoEm },
      OR: [{ vigenciaFim: null }, { vigenciaFim: { gte: recebidoEm } }],
    },
    select: { id: true },
  });
  const desvioServidorSegundos = Math.round((recebidoEm.getTime() - horaDispositivo.getTime()) / 1000);
  const classificacao = alocacao
    ? classificarMarcacao({ setor, latitude: marcacao.latitude, longitude: marcacao.longitude, selfieUrl: marcacao.selfieUrl, desvioServidorSegundos })
    : { situacao: "recusada", motivo: "sem_alocacao_vigente", dentroPerimetro: false, distanciaMetros: null };

  try {
    const criada = await prisma.marcacao.create({
      data: {
        empresaId: req.empresaId,
        usuarioId,
        setorId,
        dispositivoId: req.dispositivoId,
        tipo: marcacao.tipo,
        horaDispositivo,
        desvioServidorSegundos,
        horaServidor: recebidoEm,
        latitude: marcacao.latitude ?? null,
        longitude: marcacao.longitude ?? null,
        distanciaMetros: classificacao.distanciaMetros ?? null,
        dentroPerimetro: classificacao.dentroPerimetro ?? null,
        selfieUrl: marcacao.selfieUrl || null,
        origem,
        situacao: classificacao.situacao,
        recebidoEm,
        idLocal: marcacao.idLocal,
      },
    });
    return { idLocal: marcacao.idLocal, status: "recebida", situacao: criada.situacao, motivo: classificacao.motivo, id: criada.id };
  } catch (error) {
    if (error.code === "P2002") {
      const duplicada = await prisma.marcacao.findUnique({ where: { idLocal: marcacao.idLocal } });
      return { idLocal: marcacao.idLocal, status: "ja_recebida", situacao: duplicada?.situacao, id: duplicada?.id };
    }
    throw error;
  }
}

async function enviarLote(req, res) {
  const { marcacoes } = req.body;
  if (!Array.isArray(marcacoes) || marcacoes.length === 0 || marcacoes.length > 200) {
    return res.status(400).json({ erro: "lote_invalido", mensagem: "Envie entre 1 e 200 marcações." });
  }
  const resultados = [];
  for (const marcacao of marcacoes) resultados.push(await processarMarcacao(req, marcacao));
  return res.json({ resultados });
}

async function anexarSelfie(req, res) {
  const selfieUrl = typeof req.body.selfieUrl === "string" && req.body.selfieUrl.trim() ? req.body.selfieUrl.trim() : null;
  if (!selfieUrl) return res.status(400).json({ erro: "selfie_invalida" });
  const marcacao = await prisma.marcacao.findFirst({ where: { idLocal: req.params.idLocal, empresaId: req.empresaId, dispositivoId: req.dispositivoId } });
  if (!marcacao) return res.status(404).json({ erro: "marcacao_nao_encontrada" });
  const atualizada = await prisma.marcacao.update({ where: { id: marcacao.id }, data: { selfieUrl } });
  return res.json({ marcacao: atualizada });
}

module.exports = { enviarLote, anexarSelfie };

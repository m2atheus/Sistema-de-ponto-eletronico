const prisma = require("../config/prisma");

// Recebe o lote de marcações feitas offline. idLocal é o uuid gerado no
// aparelho: o reenvio de uma marcação já recebida não duplica.
async function enviarLote(req, res) {
  const { usuarioId, empresaId, dispositivoId } = req;
  const { marcacoes } = req.body;

  const resultados = [];

  for (const m of marcacoes) {
    const existente = await prisma.marcacao.findUnique({ where: { idLocal: m.idLocal } });
    if (existente) {
      resultados.push({ idLocal: m.idLocal, status: "ja_recebida" });
      continue;
    }

    const horaServidor = new Date(new Date(m.horaDispositivo).getTime() - m.desvioServidorSegundos * 1000);

    const criada = await prisma.marcacao.create({
      data: {
        empresaId,
        usuarioId,
        setorId: m.setorId,
        dispositivoId,
        tipo: m.tipo,
        horaDispositivo: m.horaDispositivo,
        desvioServidorSegundos: m.desvioServidorSegundos,
        horaServidor,
        latitude: m.latitude,
        longitude: m.longitude,
        distanciaMetros: m.distanciaMetros,
        dentroPerimetro: m.dentroPerimetro,
        selfieUrl: m.selfieUrl,
        origem: m.origem || "offline_sincronizada",
        idLocal: m.idLocal,
      },
    });

    resultados.push({ idLocal: m.idLocal, status: "recebida", id: criada.id });
  }

  return res.json({ resultados });
}

module.exports = { enviarLote };

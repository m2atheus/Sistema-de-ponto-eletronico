const prisma = require("../config/prisma");

// Tarefa A02 — o que o app grava no banco local na abertura, com internet:
// os dados do usuário, o(s) setor(es) e política de cada um, a escala do
// período de cada alocação vigente, e as marcações recentes (para o app
// não depender de rede para montar o dia). Junto vai a hora do servidor,
// que o app usa para calcular o próprio desvio de relógio.
async function sincronizar(req, res) {
  const { usuarioId, empresaId } = req;

  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { id: true, nome: true, email: true, perfil: true, empresaId: true },
  });

  const alocacoes = await prisma.funcionarioSetor.findMany({
    where: {
      usuarioId,
      empresaId,
      OR: [{ vigenciaFim: null }, { vigenciaFim: { gte: new Date() } }],
    },
    include: { setor: true, escala: true },
  });

  const marcacoesRecentes = await prisma.marcacao.findMany({
    where: { usuarioId, empresaId },
    orderBy: { horaServidor: "desc" },
    take: 50,
  });

  return res.json({
    horaServidor: new Date().toISOString(),
    usuario,
    alocacoes: alocacoes.map((a) => ({
      setor: {
        id: a.setor.id,
        nome: a.setor.nome,
        endereco: a.setor.endereco,
        latitude: a.setor.latitude,
        longitude: a.setor.longitude,
        raioMetros: a.setor.raioMetros,
        ignoraLocalizacao: a.setor.ignoraLocalizacao,
        exigeSelfie: a.setor.exigeSelfie,
        politicaForaPerimetro: a.setor.politicaForaPerimetro,
      },
      escala: {
        id: a.escala.id,
        nome: a.escala.nome,
        tipo: a.escala.tipo,
        cargaDiariaMinutos: a.escala.cargaDiariaMinutos,
        toleranciaMinutos: a.escala.toleranciaMinutos,
        regra: a.escala.regraJson,
      },
      vigenciaInicio: a.vigenciaInicio,
      vigenciaFim: a.vigenciaFim,
    })),
    marcacoesRecentes,
  });
}

module.exports = { sincronizar };

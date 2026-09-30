const prisma = require("../config/prisma");

// Tarefa A02 — o que o app grava no banco local na abertura, com internet:
// os dados do usuário, o(s) setor(es) e política de cada um, a escala do
// período de cada alocação vigente, e as marcações recentes (para o app
// não depender de rede para montar o dia). Junto vai a hora do servidor,
// que o app usa para calcular o próprio desvio de relógio.
async function sincronizar(req, res) {
  const { usuarioId, empresaId, dispositivo } = req;
  const agora = new Date();

  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { id: true, nome: true, email: true, perfil: true, empresaId: true },
  });

  const alocacoes = await prisma.funcionarioSetor.findMany({
    where: {
      usuarioId,
      empresaId,
      vigenciaInicio: { lte: agora },
      OR: [{ vigenciaFim: null }, { vigenciaFim: { gte: new Date() } }],
    },
    include: { setor: true, escala: true },
  });

  if (dispositivo.tipo === "modo_relogio") {
    if (!dispositivo.setorId) return res.status(409).json({ erro: "dispositivo_sem_setor" });
    const setor = await prisma.setor.findFirst({ where: { id: dispositivo.setorId, empresaId } });
    const alocacoesSetor = await prisma.funcionarioSetor.findMany({
      where: {
        empresaId,
        setorId: dispositivo.setorId,
        vigenciaInicio: { lte: agora },
        OR: [{ vigenciaFim: null }, { vigenciaFim: { gte: agora } }],
      },
      include: { usuario: { select: { id: true, nome: true, email: true, matricula: true, cargo: true } }, escala: true },
    });
    const feriados = await prisma.feriado.findMany({
      where: { empresaId, data: { gte: agora }, OR: [{ setorId: null }, { setorId: dispositivo.setorId }] },
      orderBy: { data: "asc" },
      take: 100,
    });
    return res.json({
      modo: "relogio",
      horaServidor: agora.toISOString(),
      usuario,
      setor,
      feriados,
      funcionarios: alocacoesSetor.map((alocacao) => ({
        ...alocacao.usuario,
        alocacaoId: alocacao.id,
        escala: alocacao.escala,
        vigenciaInicio: alocacao.vigenciaInicio,
        vigenciaFim: alocacao.vigenciaFim,
      })),
    });
  }

  const marcacoesRecentes = await prisma.marcacao.findMany({
    where: { usuarioId, empresaId },
    orderBy: { horaServidor: "desc" },
    take: 50,
  });
  const setorIds = alocacoes.map((alocacao) => alocacao.setorId);
  const [feriados, afastamentos] = await Promise.all([
    prisma.feriado.findMany({
      where: {
        empresaId,
        data: { gte: agora },
        OR: [{ setorId: null }, ...(setorIds.length ? [{ setorId: { in: setorIds } }] : [])],
      },
      orderBy: { data: "asc" },
      take: 100,
    }),
    prisma.afastamento.findMany({
      where: { empresaId, usuarioId, dataFim: { gte: agora } },
      orderBy: { dataInicio: "asc" },
    }),
  ]);

  return res.json({
    horaServidor: agora.toISOString(),
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
    feriados,
    afastamentos,
    marcacoesRecentes,
  });
}

module.exports = { sincronizar };

const prisma = require("../config/prisma");
const { CICLOS, duracaoTurnoMinutos, expandirTurnos, projetarEscala, validarTurnos } = require("../domain/schedule-rules");

const modelos = new Set(["ciclo_24x72", "ciclo_12x36", "diurno", "comercial_5x2"]);

function empresaIdDaRequisicao(req) {
  return req.perfil === "superadmin" ? req.query.empresaId || req.body.empresaId || null : req.empresaId;
}

function normalizarModelo(valor) {
  const aliases = { "24x72": "ciclo_24x72", "12x36": "ciclo_12x36" };
  const modelo = aliases[valor] || valor;
  return modelos.has(modelo) ? modelo : null;
}

function parseReferencia(valor) {
  if (typeof valor !== "string" && !(valor instanceof Date)) return null;
  const referencia = new Date(valor);
  return Number.isFinite(referencia.getTime()) ? referencia : null;
}

function normalizarTurnos(turnos) {
  const expandidos = expandirTurnos(turnos);
  return expandidos.map((turno) => ({
    diaSemana: turno.diaSemana,
    horaInicio: turno.horaInicio,
    horaFim: turno.horaFim,
    intervaloMinutos: turno.intervaloMinutos ?? 0,
  }));
}

function validarEscala(modelo, referencia, turnos) {
  if (!modelo) return "Modelo de escala inválido.";
  if (CICLOS[modelo] && !referencia) return "Escalas 24x72 e 12x36 exigem data de referência.";
  if (!CICLOS[modelo] && referencia) return "Data de referência é aceita somente para escalas cíclicas.";
  return validarTurnos(modelo, turnos);
}

function cargaDiaria(modelo, turnos) {
  if (CICLOS[modelo]) {
    const turno = turnos[0];
    return duracaoTurnoMinutos(turno.horaInicio, turno.horaFim) - turno.intervaloMinutos;
  }
  const totaisPorDia = new Map();
  for (const turno of turnos) {
    const total = (totaisPorDia.get(turno.diaSemana) || 0) +
      duracaoTurnoMinutos(turno.horaInicio, turno.horaFim) - turno.intervaloMinutos;
    totaisPorDia.set(turno.diaSemana, total);
  }
  return Math.max(...totaisPorDia.values());
}

function tratarErro(res, error) {
  if (error.code === "P2025") return res.status(404).json({ erro: "escala_nao_encontrada" });
  if (error.code === "P2003" || error.code === "P2014") {
    return res.status(409).json({ erro: "escala_em_uso", mensagem: "A escala está vinculada a alocações e não pode ser excluída." });
  }
  return res.status(500).json({ erro: "erro_interno" });
}

async function listar(req, res) {
  const empresaId = empresaIdDaRequisicao(req);
  if (req.perfil !== "superadmin" && !empresaId) return res.status(403).json({ erro: "empresa_obrigatoria" });
  try {
    const escalas = await prisma.escala.findMany({
      where: empresaId ? { empresaId } : undefined,
      include: { turnos: { orderBy: [{ diaSemana: "asc" }, { horaInicio: "asc" }] }, setor: { select: { id: true, nome: true } } },
      orderBy: { nome: "asc" },
    });
    return res.json({ escalas });
  } catch (error) {
    return tratarErro(res, error);
  }
}

async function obter(req, res) {
  const empresaId = empresaIdDaRequisicao(req);
  try {
    const escala = await prisma.escala.findFirst({
      where: { id: req.params.id, ...(empresaId ? { empresaId } : {}) },
      include: { turnos: { orderBy: [{ diaSemana: "asc" }, { horaInicio: "asc" }] }, setor: { select: { id: true, nome: true } } },
    });
    if (!escala) return res.status(404).json({ erro: "escala_nao_encontrada" });
    return res.json({ escala });
  } catch (error) {
    return tratarErro(res, error);
  }
}

async function criar(req, res) {
  const empresaId = empresaIdDaRequisicao(req);
  const modelo = normalizarModelo(req.body.modelo);
  const referencia = parseReferencia(req.body.dataReferencia);
  const turnos = normalizarTurnos(req.body.turnos);
  const erro = validarEscala(modelo, referencia, turnos);
  const { nome, setorId } = req.body;
  const toleranciaMinutos = req.body.toleranciaMinutos ?? 5;
  if (!empresaId || !setorId || typeof nome !== "string" || !nome.trim() || erro ||
      !Number.isInteger(toleranciaMinutos) || toleranciaMinutos < 0) {
    return res.status(400).json({ erro: "dados_invalidos", mensagem: erro || "Nome, setor, turnos e tolerância válida são obrigatórios." });
  }

  try {
    const setor = await prisma.setor.findFirst({ where: { id: setorId, empresaId }, select: { id: true } });
    if (!setor) return res.status(404).json({ erro: "setor_nao_encontrado" });
    const escala = await prisma.escala.create({
      data: {
        empresaId,
        setorId,
        nome: nome.trim(),
        tipo: CICLOS[modelo] ? "escala_turno" : "fixa_semanal",
        modelo,
        dataReferencia: referencia,
        cargaDiariaMinutos: cargaDiaria(modelo, turnos),
        toleranciaMinutos,
        regraJson: { modelo, dataReferencia: referencia?.toISOString() ?? null },
        turnos: { create: turnos },
      },
      include: { turnos: { orderBy: [{ diaSemana: "asc" }, { horaInicio: "asc" }] } },
    });
    return res.status(201).json({ escala });
  } catch (error) {
    return tratarErro(res, error);
  }
}

async function atualizar(req, res) {
  const empresaId = empresaIdDaRequisicao(req);
  try {
    const existente = await prisma.escala.findFirst({
      where: { id: req.params.id, ...(empresaId ? { empresaId } : {}) },
      include: { turnos: true },
    });
    if (!existente) return res.status(404).json({ erro: "escala_nao_encontrada" });

    const modelo = req.body.modelo === undefined ? existente.modelo : normalizarModelo(req.body.modelo);
    const referencia = req.body.dataReferencia === undefined
      ? existente.dataReferencia
      : parseReferencia(req.body.dataReferencia);
    const turnos = normalizarTurnos(req.body.turnos === undefined ? existente.turnos : req.body.turnos);
    const erro = validarEscala(modelo, referencia, turnos);
    if (erro) return res.status(400).json({ erro: "dados_invalidos", mensagem: erro });

    const data = {};
    if (typeof req.body.nome === "string" && req.body.nome.trim()) data.nome = req.body.nome.trim();
    if (req.body.setorId !== undefined) {
      const setorId = req.body.setorId;
      const setor = await prisma.setor.findFirst({ where: { id: setorId, empresaId }, select: { id: true } });
      if (!setor) return res.status(404).json({ erro: "setor_nao_encontrado" });
      data.setorId = setorId;
    }
    if (req.body.toleranciaMinutos !== undefined) {
      if (!Number.isInteger(req.body.toleranciaMinutos) || req.body.toleranciaMinutos < 0) return res.status(400).json({ erro: "tolerancia_invalida" });
      data.toleranciaMinutos = req.body.toleranciaMinutos;
    }
    data.modelo = modelo;
    data.tipo = CICLOS[modelo] ? "escala_turno" : "fixa_semanal";
    data.dataReferencia = referencia;
    data.cargaDiariaMinutos = cargaDiaria(modelo, turnos);
    data.regraJson = { modelo, dataReferencia: referencia?.toISOString() ?? null };

    const escala = await prisma.$transaction(async (tx) => {
      const atualizada = await tx.escala.update({ where: { id: existente.id }, data });
      if (req.body.turnos !== undefined || req.body.modelo !== undefined) {
        await tx.turnoEscala.deleteMany({ where: { escalaId: existente.id } });
        await tx.turnoEscala.createMany({ data: turnos.map((turno) => ({ ...turno, escalaId: existente.id })) });
      }
      return tx.escala.findUnique({ where: { id: atualizada.id }, include: { turnos: true } });
    });
    return res.json({ escala });
  } catch (error) {
    return tratarErro(res, error);
  }
}

async function excluir(req, res) {
  const empresaId = empresaIdDaRequisicao(req);
  try {
    const escala = await prisma.escala.findFirst({
      where: { id: req.params.id, ...(empresaId ? { empresaId } : {}) },
      include: { alocacoes: { select: { id: true }, take: 1 } },
    });
    if (!escala) return res.status(404).json({ erro: "escala_nao_encontrada" });
    if (escala.alocacoes.length) return res.status(409).json({ erro: "escala_em_uso" });
    await prisma.escala.delete({ where: { id: escala.id } });
    return res.status(204).end();
  } catch (error) {
    return tratarErro(res, error);
  }
}

async function projetar(req, res) {
  const empresaId = empresaIdDaRequisicao(req);
  try {
    const escala = await prisma.escala.findFirst({
      where: { id: req.params.id, ...(empresaId ? { empresaId } : {}) },
      include: { turnos: true },
    });
    if (!escala) return res.status(404).json({ erro: "escala_nao_encontrada" });
    const dataInicio = req.query.dataInicio || new Date().toISOString().slice(0, 10);
    const dias = req.query.dias === undefined ? 30 : Number(req.query.dias);
    const projecao = projetarEscala({
      modelo: escala.modelo,
      dataReferencia: escala.dataReferencia,
      dataInicio,
      dias,
      turnos: escala.turnos,
    });
    return res.json({ escalaId: escala.id, dataReferencia: escala.dataReferencia, projecao });
  } catch (error) {
    return res.status(400).json({ erro: "projecao_invalida", mensagem: error.message });
  }
}

module.exports = { listar, obter, criar, atualizar, excluir, projetar };
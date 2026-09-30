const prisma = require("../config/prisma");

const politicas = new Set(["bloquear", "pendente_analise"]);

function empresaIdDaRequisicao(req) {
  return req.perfil === "superadmin" ? req.query.empresaId || req.body.empresaId || null : req.empresaId;
}

function validarCoordenadas(latitude, longitude) {
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
    Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

function tratarErro(res, error) {
  if (error.code === "P2025") return res.status(404).json({ erro: "setor_nao_encontrado" });
  if (error.code === "P2003" || error.code === "P2014") {
    return res.status(409).json({ erro: "setor_em_uso", mensagem: "Setor possui registros vinculados e não pode ser excluído." });
  }
  return res.status(500).json({ erro: "erro_interno" });
}

async function listar(req, res) {
  const empresaId = empresaIdDaRequisicao(req);
  if (req.perfil !== "superadmin" && !empresaId) return res.status(403).json({ erro: "empresa_obrigatoria" });
  try {
    const setores = await prisma.setor.findMany({
      where: empresaId ? { empresaId } : undefined,
      include: { alocacoes: { where: { OR: [{ vigenciaFim: null }, { vigenciaFim: { gte: new Date() } }] }, select: { id: true } } },
      orderBy: { nome: "asc" },
    });
    return res.json({ setores: setores.map(({ alocacoes, ...setor }) => ({ ...setor, funcionariosAtivos: alocacoes.length })) });
  } catch (error) {
    return tratarErro(res, error);
  }
}

async function obter(req, res) {
  const empresaId = empresaIdDaRequisicao(req);
  try {
    const setor = await prisma.setor.findFirst({
      where: { id: req.params.id, ...(empresaId ? { empresaId } : {}) },
    });
    if (!setor) return res.status(404).json({ erro: "setor_nao_encontrado" });
    return res.json({ setor });
  } catch (error) {
    return tratarErro(res, error);
  }
}

async function criar(req, res) {
  const empresaId = empresaIdDaRequisicao(req);
  const { nome, endereco, latitude, longitude, raioMetros } = req.body;
  const politicaForaPerimetro = req.body.politicaForaPerimetro || "bloquear";
  if (
    !empresaId || typeof nome !== "string" || !nome.trim() ||
    !validarCoordenadas(latitude, longitude) || !Number.isInteger(raioMetros) || raioMetros <= 0 ||
    !politicas.has(politicaForaPerimetro) ||
    (req.body.ignoraLocalizacao !== undefined && typeof req.body.ignoraLocalizacao !== "boolean") ||
    (req.body.exigeSelfie !== undefined && typeof req.body.exigeSelfie !== "boolean")
  ) {
    return res.status(400).json({ erro: "dados_invalidos", mensagem: "Nome, coordenadas válidas e raio maior que zero são obrigatórios." });
  }

  try {
    const empresa = await prisma.empresa.findUnique({ where: { id: empresaId }, select: { id: true } });
    if (!empresa) return res.status(404).json({ erro: "empresa_nao_encontrada" });
    const setor = await prisma.setor.create({
      data: {
        empresaId,
        nome: nome.trim(),
        endereco: typeof endereco === "string" ? endereco.trim() || null : null,
        latitude,
        longitude,
        raioMetros,
        ignoraLocalizacao: req.body.ignoraLocalizacao ?? false,
        exigeSelfie: req.body.exigeSelfie ?? false,
        politicaForaPerimetro,
      },
    });
    return res.status(201).json({ setor });
  } catch (error) {
    return tratarErro(res, error);
  }
}

async function atualizar(req, res) {
  const empresaId = empresaIdDaRequisicao(req);
  const existente = await prisma.setor.findFirst({
    where: { id: req.params.id, ...(empresaId ? { empresaId } : {}) },
  });
  if (!existente) return res.status(404).json({ erro: "setor_nao_encontrado" });

  const data = {};
  if (typeof req.body.nome === "string" && req.body.nome.trim()) data.nome = req.body.nome.trim();
  if (typeof req.body.endereco === "string") data.endereco = req.body.endereco.trim() || null;
  if (req.body.latitude !== undefined || req.body.longitude !== undefined) {
    const latitude = req.body.latitude ?? existente.latitude;
    const longitude = req.body.longitude ?? existente.longitude;
    if (!validarCoordenadas(latitude, longitude)) return res.status(400).json({ erro: "coordenadas_invalidas" });
    data.latitude = latitude;
    data.longitude = longitude;
  }
  if (req.body.raioMetros !== undefined) {
    if (!Number.isInteger(req.body.raioMetros) || req.body.raioMetros <= 0) return res.status(400).json({ erro: "raio_invalido" });
    data.raioMetros = req.body.raioMetros;
  }
  if (req.body.ignoraLocalizacao !== undefined) {
    if (typeof req.body.ignoraLocalizacao !== "boolean") return res.status(400).json({ erro: "politica_invalida" });
    data.ignoraLocalizacao = req.body.ignoraLocalizacao;
  }
  if (req.body.exigeSelfie !== undefined) {
    if (typeof req.body.exigeSelfie !== "boolean") return res.status(400).json({ erro: "politica_invalida" });
    data.exigeSelfie = req.body.exigeSelfie;
  }
  if (req.body.politicaForaPerimetro !== undefined) {
    if (!politicas.has(req.body.politicaForaPerimetro)) return res.status(400).json({ erro: "politica_invalida" });
    data.politicaForaPerimetro = req.body.politicaForaPerimetro;
  }
  if (!Object.keys(data).length) return res.status(400).json({ erro: "dados_invalidos" });

  try {
    const setor = await prisma.setor.update({ where: { id: existente.id }, data });
    return res.json({ setor });
  } catch (error) {
    return tratarErro(res, error);
  }
}

async function excluir(req, res) {
  const empresaId = empresaIdDaRequisicao(req);
  try {
    const setor = await prisma.setor.findFirst({
      where: { id: req.params.id, ...(empresaId ? { empresaId } : {}) },
      include: {
        alocacoes: {
          where: {
            vigenciaInicio: { lte: new Date() },
            OR: [{ vigenciaFim: null }, { vigenciaFim: { gte: new Date() } }],
          },
          select: { id: true },
        },
      },
    });
    if (!setor) return res.status(404).json({ erro: "setor_nao_encontrado" });
    if (setor.alocacoes.length) {
      return res.status(409).json({ erro: "setor_com_funcionarios", mensagem: "Encerre as alocações ativas antes de excluir este setor." });
    }
    await prisma.setor.delete({ where: { id: setor.id } });
    return res.status(204).end();
  } catch (error) {
    return tratarErro(res, error);
  }
}

module.exports = { listar, obter, criar, atualizar, excluir };
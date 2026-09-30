const prisma = require("../config/prisma");

function tratarErro(res, error) {
  if (error.code === "P2002") {
    return res.status(409).json({ erro: "empresa_duplicada", mensagem: "Já existe uma empresa com esse CNPJ." });
  }
  if (error.code === "P2025") return res.status(404).json({ erro: "empresa_nao_encontrada" });
  return res.status(500).json({ erro: "erro_interno" });
}

async function listar(_req, res) {
  try {
    const empresas = await prisma.empresa.findMany({ orderBy: { razaoSocial: "asc" } });
    return res.json({ empresas });
  } catch (error) {
    return tratarErro(res, error);
  }
}

async function obter(req, res) {
  try {
    const empresa = await prisma.empresa.findUnique({ where: { id: req.params.id } });
    if (!empresa) return res.status(404).json({ erro: "empresa_nao_encontrada" });
    return res.json({ empresa });
  } catch (error) {
    return tratarErro(res, error);
  }
}

async function criar(req, res) {
  const { razaoSocial, cnpj, contato, ativo = true } = req.body;
  if (typeof razaoSocial !== "string" || !razaoSocial.trim() || typeof ativo !== "boolean") {
    return res.status(400).json({ erro: "dados_invalidos" });
  }

  try {
    const empresa = await prisma.empresa.create({
      data: {
        razaoSocial: razaoSocial.trim(),
        cnpj: typeof cnpj === "string" && cnpj.trim() ? cnpj.trim() : null,
        contato: typeof contato === "string" && contato.trim() ? contato.trim() : null,
        ativo,
      },
    });
    return res.status(201).json({ empresa });
  } catch (error) {
    return tratarErro(res, error);
  }
}

async function atualizar(req, res) {
  const data = {};
  if (typeof req.body.razaoSocial === "string" && req.body.razaoSocial.trim()) data.razaoSocial = req.body.razaoSocial.trim();
  if (typeof req.body.cnpj === "string") data.cnpj = req.body.cnpj.trim() || null;
  if (typeof req.body.contato === "string") data.contato = req.body.contato.trim() || null;
  if (typeof req.body.ativo === "boolean") data.ativo = req.body.ativo;
  if (!Object.keys(data).length) return res.status(400).json({ erro: "dados_invalidos" });

  try {
    const empresa = await prisma.empresa.update({ where: { id: req.params.id }, data });
    return res.json({ empresa });
  } catch (error) {
    return tratarErro(res, error);
  }
}

module.exports = { listar, obter, criar, atualizar };
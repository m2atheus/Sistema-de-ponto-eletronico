const express = require("express");
const { autenticar, autorizar } = require("../middlewares/auth.middleware");
const controller = require("../controllers/funcionario.controller");

const router = express.Router();
router.use(autenticar, autorizar("superadmin", "rh", "gestor"));
router.get("/", controller.listar);
router.post("/", autorizar("superadmin", "rh"), controller.criar);
router.get("/setor/:setorId", controller.listarPorSetor);
router.patch("/alocacoes/:alocacaoId/encerrar", autorizar("superadmin", "rh"), controller.encerrarAlocacao);
router.get("/:id/alocacoes", controller.listarAlocacoes);
router.post("/:id/alocacoes", autorizar("superadmin", "rh"), controller.criarAlocacao);

module.exports = router;
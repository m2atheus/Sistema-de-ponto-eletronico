const express = require("express");
const { autenticar, autorizar } = require("../middlewares/auth.middleware");
const controller = require("../controllers/escala.controller");

const router = express.Router();
router.use(autenticar, autorizar("superadmin", "rh", "gestor"));
router.get("/", controller.listar);
router.post("/", controller.criar);
router.get("/:id/projecao", controller.projetar);
router.get("/:id", controller.obter);
router.patch("/:id", controller.atualizar);
router.delete("/:id", controller.excluir);

module.exports = router;
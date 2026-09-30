const express = require("express");
const { autenticar, autorizar } = require("../middlewares/auth.middleware");
const controller = require("../controllers/setor.controller");

const router = express.Router();
router.use(autenticar, autorizar("superadmin", "rh", "gestor"));
router.get("/", controller.listar);
router.get("/:id", controller.obter);
router.post("/", controller.criar);
router.patch("/:id", controller.atualizar);
router.delete("/:id", controller.excluir);

module.exports = router;
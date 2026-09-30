const express = require("express");
const { autenticar, autorizar } = require("../middlewares/auth.middleware");
const controller = require("../controllers/usuario.controller");

const router = express.Router();
router.use(autenticar);
router.get("/", autorizar("superadmin", "rh", "gestor"), controller.listar);
router.get("/:id", autorizar("superadmin", "rh", "gestor"), controller.obter);
router.post("/", autorizar("superadmin", "rh"), controller.criar);
router.patch("/:id", autorizar("superadmin", "rh"), controller.atualizar);

module.exports = router;
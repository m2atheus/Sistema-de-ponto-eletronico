const express = require("express");
const { autenticar, autorizar } = require("../middlewares/auth.middleware");
const controller = require("../controllers/dispositivo.controller");

const router = express.Router();
router.post("/:id/modo", autenticar, controller.trocarModo);
router.use(autenticar, autorizar("superadmin", "rh", "gestor"));
router.get("/", controller.listar);
router.post("/", autorizar("superadmin", "rh"), controller.criar);
router.patch("/:id", autorizar("superadmin", "rh"), controller.atualizar);

module.exports = router;

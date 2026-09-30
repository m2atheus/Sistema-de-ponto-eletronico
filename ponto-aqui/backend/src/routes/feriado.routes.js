const express = require("express");
const { autenticar, autorizar } = require("../middlewares/auth.middleware");
const controller = require("../controllers/feriado.controller");

const router = express.Router();
router.use(autenticar, autorizar("superadmin", "rh", "gestor"));
router.get("/", controller.listar);
router.post("/", autorizar("superadmin", "rh"), controller.criar);
router.delete("/:id", autorizar("superadmin", "rh"), controller.excluir);

module.exports = router;

const express = require("express");
const { autenticar, autorizar } = require("../middlewares/auth.middleware");
const controller = require("../controllers/empresa.controller");

const router = express.Router();
router.use(autenticar, autorizar("superadmin"));
router.get("/", controller.listar);
router.get("/:id", controller.obter);
router.post("/", controller.criar);
router.patch("/:id", controller.atualizar);

module.exports = router;
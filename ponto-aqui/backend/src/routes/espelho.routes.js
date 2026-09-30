const express = require("express");
const { autenticar, autorizar } = require("../middlewares/auth.middleware");
const controller = require("../controllers/espelho.controller");

const router = express.Router();
router.use(autenticar);
router.get("/", autorizar("superadmin", "rh", "gestor", "funcionario"), controller.obter);

module.exports = router;

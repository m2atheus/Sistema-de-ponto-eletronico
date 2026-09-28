const express = require("express");
const { autenticar } = require("../middlewares/auth.middleware");
const { enviarLote } = require("../controllers/marcacao.controller");

const router = express.Router();

router.post("/lote", autenticar, enviarLote);

module.exports = router;

const express = require("express");
const { autenticar } = require("../middlewares/auth.middleware");
const { enviarLote, anexarSelfie } = require("../controllers/marcacao.controller");

const router = express.Router();

router.post("/lote", autenticar, enviarLote);
router.post("/:idLocal/selfie", autenticar, anexarSelfie);

module.exports = router;

const express = require("express");
const { autenticar } = require("../middlewares/auth.middleware");
const { sincronizar } = require("../controllers/sync.controller");

const router = express.Router();

router.get("/", autenticar, sincronizar);

module.exports = router;

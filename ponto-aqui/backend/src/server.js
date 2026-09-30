require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const syncRoutes = require("./routes/sync.routes");
const marcacaoRoutes = require("./routes/marcacao.routes");
const empresaRoutes = require("./routes/empresa.routes");
const usuarioRoutes = require("./routes/usuario.routes");
const setorRoutes = require("./routes/setor.routes");
const funcionarioRoutes = require("./routes/funcionario.routes");
const escalaRoutes = require("./routes/escala.routes");

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" })); // selfie em base64 cabe aqui na primeira versão

app.use("/auth", authRoutes);
app.use("/sync", syncRoutes);
app.use("/marcacoes", marcacaoRoutes);
app.use("/empresas", empresaRoutes);
app.use("/usuarios", usuarioRoutes);
app.use("/setores", setorRoutes);
app.use("/funcionarios", funcionarioRoutes);
app.use("/escalas", escalaRoutes);

app.get("/health", (_req, res) => res.json({ ok: true, horaServidor: new Date().toISOString() }));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Ponto Aqui API rodando na porta ${port}`));

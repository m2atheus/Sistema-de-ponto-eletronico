require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const syncRoutes = require("./routes/sync.routes");
const marcacaoRoutes = require("./routes/marcacao.routes");

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" })); // selfie em base64 cabe aqui na primeira versão

app.use("/auth", authRoutes);
app.use("/sync", syncRoutes);
app.use("/marcacoes", marcacaoRoutes);

app.get("/health", (_req, res) => res.json({ ok: true, horaServidor: new Date().toISOString() }));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Ponto Aqui API rodando na porta ${port}`));

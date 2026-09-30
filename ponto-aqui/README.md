# Ponto Aqui

Sistema de ponto com registro pelo celular, mesmo sem internet, hora conferida contra o servidor, posição conferida contra o perímetro do setor e correção sempre via justificativa e aprovação.

## Estrutura

- `backend/prisma/` — schema PostgreSQL e configuração do Prisma.
- `backend/src/config/` — conexão com o banco.
- `backend/src/controllers/` — autenticação, empresas, usuários, setores, funcionários, escalas e sincronização.
- `backend/src/domain/` — validações puras de vigências e regras/projeção de escalas.
- `backend/src/middlewares/` — autenticação JWT e autorização por perfil.
- `backend/src/routes/` — endpoints da API.
- `app/lib/screens/` — telas de login, funcionário e administração.
- `app/lib/services/` — clientes de API, autenticação, banco local, conectividade e sincronização.
- `docs/` — critérios A01/A02 e modelagem de dados.

## Módulos WEB implementados

- `W01`: cadastro de empresas e usuários, login por e-mail/usuário, senha bcrypt, JWT, perfis e isolamento por empresa.
- `W02`: CRUD de setores, validação de coordenadas/raio e políticas de selfie/perímetro entregues na sincronização.
- `W03`: cadastro de funcionários, matrícula única por empresa, histórico e encerramento de alocações sem apagar registros.
- `W04`: escalas 24x72, 12x36, diurno e comercial 5x2, turnos noturnos e projeção a partir da data de referência.

As rotas administrativas exigem JWT. Superadmin pode escolher a empresa; os demais perfis ficam limitados à empresa do próprio token.

## Como rodar o backend

```bash
cd backend
npm ci
npx prisma db push
npm run dev
```

## Como rodar o app

```bash
cd app
flutter pub get
flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:3000
```

Configure `DATABASE_URL`, `JWT_SECRET` e `PORT` em `backend/.env` antes de iniciar a API. O endereço do app pode ser trocado por `API_BASE_URL` no `--dart-define`; em emulador Android, use `http://10.0.2.2:3000`.

## Próximos passos (fora do escopo de A01/A02)

- Fluxo APP de bater ponto com captura de localização/selfie e apresentação do dia.
- Estados e análise de marcações fora do perímetro ou com desvio de relógio.
- Dispositivos em modo relógio, justificativas, ajustes, espelho, fechamento e relatórios.

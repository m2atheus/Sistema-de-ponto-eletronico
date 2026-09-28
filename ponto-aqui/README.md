# Ponto Aqui

Sistema de ponto com registro pelo celular, mesmo sem internet, hora conferida contra o servidor, posição conferida contra o perímetro do setor e correção sempre via justificativa e aprovação.

## Estrutura

- `backend/` — API (Node.js + Express + Prisma). Contém o schema de banco completo (`prisma/schema.prisma`) e, por enquanto, as rotas de login, sincronização e envio de marcações offline.
- `app/` — aplicativo Flutter. Implementa as tarefas A01 (abertura e login offline-first) e A02 (sincronização e banco local).
- `docs/` — modelagem de dados da Etapa E1 e o mapeamento de cada critério de aceite para o código correspondente.

## Como rodar o backend

```bash
cd backend
cp .env.example .env   # ajuste DATABASE_URL e JWT_SECRET
npm install
npx prisma migrate dev --name inicial
npm run dev
```

## Como rodar o app

```bash
cd app
flutter pub get
flutter run
```

Por padrão o app aponta para `https://api.pontoaqui.exemplo.com` (`ApiService.baseUrl`) — troque pelo endereço do backend local ao testar (em emulador Android, `http://10.0.2.2:3000`).

## Próximos passos (fora do escopo de A01/A02)

- Tela de registro de ponto em si (captura de selfie, posição e os quatro tipos de marcação), fila de envio e modo relógio.
- Web: cadastro de empresas, setores, escalas com checagem de conflito, alocação, dispositivos.
- Justificativas, ajustes, espelho de ponto, fechamento e relatórios.

# Sistema de Ponto Eletrônico

O código do produto está em [`ponto-aqui/`](ponto-aqui/README.md). A raiz deste repositório reúne a documentação de entrada e as regras comuns de Git.

## Mapa do projeto

| Caminho | Responsabilidade |
| --- | --- |
| `ponto-aqui/app/` | Aplicativo Flutter para Android, Windows e Web |
| `ponto-aqui/app/lib/screens/` | Telas de login, ponto e administração |
| `ponto-aqui/app/lib/services/` | Autenticação, API, banco local, conectividade e sincronização |
| `ponto-aqui/backend/` | API Node.js/Express e banco PostgreSQL via Prisma |
| `ponto-aqui/backend/src/controllers/` | Regras HTTP dos módulos |
| `ponto-aqui/backend/src/domain/` | Regras puras de alocações e escalas |
| `ponto-aqui/backend/src/routes/` | Endpoints e permissões por perfil |
| `ponto-aqui/docs/` | Critérios de aceite e modelagem de dados |

## Executar localmente

Inicie o PostgreSQL e configure `DATABASE_URL`, `JWT_SECRET` e `PORT` em `ponto-aqui/backend/.env`. Em seguida:

```powershell
Set-Location ponto-aqui/backend
npm ci
npx prisma db push
npm run dev
```

Em outro terminal, inicie o app apontando para a API local:

```powershell
Set-Location ponto-aqui/app
flutter pub get
flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:3000
```

## Documentação

- [Critérios A01/A02](ponto-aqui/docs/criterios-a01-a02.md)
- [Modelagem de dados](ponto-aqui/docs/modelagem-dados.md)
- Os módulos WEB W01-W04 estão implementados em `ponto-aqui/backend/src/controllers/`, com regras de domínio em `ponto-aqui/backend/src/domain/`.
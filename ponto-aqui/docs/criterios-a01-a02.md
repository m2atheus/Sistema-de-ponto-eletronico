# De onde vem cada critério de aceite

## A01 — abertura e login offline-first

| Critério | Onde está implementado |
|---|---|
| Tela de abertura atualiza com internet e segue sem ela | `app/lib/screens/splash_screen.dart` + `SyncService.sincronizarSePossivel` |
| Login com usuário e senha, token guardado no aparelho | `LoginScreen` + `AuthService.login` (token em `flutter_secure_storage`) |
| Quem já entrou consegue abrir sem rede e chegar à tela de bater ponto | `AuthService.sessaoAtiva` checa sessão local, sem depender de rede |
| Erro de login genérico | `ApiService.login` lança mensagem única, sem apontar campo |
| Sem rede, avisa sem impedir o uso | `_semInternet` em `LoginScreen`/`HomeScreen`, sem bloquear ações |
| Sair pede confirmação e avisa marcação pendente | `HomeScreen._sair` + `AuthService.quantidadeMarcacoesPendentes` |
| Token vencido manda para login sem perder fila | `AuthService.invalidarSessaoPorTokenExpirado` limpa só a sessão, mantém a tabela `marcacao` |

## A02 — sincronização e dados locais

| Critério | Onde está implementado |
|---|---|
| Abertura grava usuário, setor, política, escala e marcações recentes | `SyncService.sincronizarSePossivel` + `GET /sync` no backend |
| Sem internet, usa o que está guardado, sem erro | `ConnectivityService.temInternet` interrompe cedo, sem lançar exceção |
| Tela mostra data/hora da última atualização | `LocalDbService.ultimaSincronizacaoEm` exibida em `HomeScreen` |
| Atualização interrompida não deixa dado pela metade | `LocalDbService.gravarSincronizacao` roda tudo em uma `transaction` |
| Mudança de setor/escala no servidor aparece na atualização seguinte | `sync.controller.js` sempre busca as alocações vigentes atuais; o app substitui (não mescla) `setor`/`escala`/`alocacao` a cada sincronização |
| Ação explícita de "atualizar agora" além da automática | Botão em `HomeScreen` chama o mesmo `SyncService.sincronizarSePossivel` |
| Dados locais apagados ao sair da conta | `AuthService.logout` → `LocalDbService.limparTudo` |

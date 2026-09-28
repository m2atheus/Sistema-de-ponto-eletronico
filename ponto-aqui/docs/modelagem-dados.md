# Ponto Aqui — Modelagem de Dados (Etapa E1)

## Visão geral

O modelo cobre as três regras que sustentam o sistema: uma empresa só enxerga a si mesma, um funcionário pode estar em mais de um setor (com vigência) e nenhuma escala pode colocar a mesma pessoa em dois lugares no mesmo horário.

## Entidades

### Empresa
Isolamento de dados começa aqui. Toda tabela abaixo (exceto `superadmin`) carrega `empresa_id`, e toda consulta da API filtra por ele.

- id
- razao_social
- cnpj
- ativo
- criado_em

### Usuario
Conta de acesso, comum a todos os perfis. O perfil define o que a conta enxerga.

- id
- empresa_id (nulo para superadmin)
- nome
- email
- senha_hash
- perfil (superadmin | rh | gestor | funcionario | usuario_setor)
- ativo
- criado_em

### Setor
- id
- empresa_id
- nome
- latitude
- longitude
- raio_metros
- ignora_localizacao (bool)

### Escala
Modelo de jornada. Um setor pode ter mais de uma escala vigente ao mesmo tempo (ex.: turno diurno e noturno).

- id
- empresa_id
- setor_id
- nome (ex.: "Jornada padrão", "24x72")
- tipo (fixa_semanal | escala_turno)
- carga_diaria_minutos
- tolerancia_minutos
- regra_json (dias da semana e horários, ou padrão de turno tipo 24x72/12x36 com data-base)

### FuncionarioSetor (alocação)
É o histórico de onde cada funcionário trabalhou — e é aqui que mora a checagem de conflito.

- id
- empresa_id
- usuario_id
- setor_id
- escala_id
- vigencia_inicio
- vigencia_fim (nulo = em curso)

Regra de conflito: ao salvar, o servidor recalcula os intervalos de horário que a escala produz (considerando virada de meia-noite) para o período de vigência e rejeita se colidirem com os intervalos de outra alocação ativa do mesmo `usuario_id`.

### Dispositivo
- id
- empresa_id
- usuario_id (nulo quando é dispositivo de setor, modo relógio)
- setor_id (preenchido quando é modo relógio)
- identificador (hash do aparelho)
- tipo (pessoal | modo_relogio)
- status (ativo | aguardando | bloqueado)
- ultimo_login_em

Login em novo aparelho desloga o anterior: ao autenticar, o servidor invalida o token do dispositivo anterior do mesmo `usuario_id`.

### Marcacao
Registro imutável. Nada aqui é editado — correção é linha nova via ajuste aprovado.

- id
- empresa_id
- usuario_id
- setor_id
- dispositivo_id
- tipo (entrada | saida_intervalo | retorno_intervalo | saida)
- hora_dispositivo (hora local do aparelho no momento do toque)
- desvio_servidor_segundos (diferença entre relógio do aparelho e do servidor na última sincronização)
- hora_servidor (hora_dispositivo corrigida pelo desvio — é o valor que vale)
- latitude, longitude (nulo se o setor ignora localização)
- distancia_metros (calculada contra o setor)
- dentro_perimetro (bool)
- selfie_url (nulo se a política do dispositivo não exige)
- origem (online | offline_sincronizada)
- id_local (uuid gerado no aparelho, evita duplicidade no reenvio)
- criado_em

### Justificativa
- id
- empresa_id
- usuario_id
- data_ocorrencia
- tipo (atraso | falta | outro)
- descricao
- anexo_url
- status (aberta | aprovada | reprovada)
- parecer
- analisado_por
- analisado_em

### AjusteMarcacao
- id
- empresa_id
- usuario_id
- marcacao_id (nulo quando é marcação esquecida, sem registro original)
- tipo (corrigir | incluir)
- horario_solicitado
- justificativa_id
- status (aberta | aprovada | reprovada)
- parecer
- analisado_por
- analisado_em
- criado_em

Aprovar não apaga nada: o espelho passa a considerar o `horario_solicitado`, mas a marcação original, o pedido, o parecer e quem aprovou continuam visíveis.

### FechamentoPeriodo
- id
- empresa_id
- usuario_id
- competencia (ano-mes)
- status (aberto | fechado)
- fechado_por
- fechado_em
- saldo_horas_minutos

Depois de fechado, nenhuma marcação ou ajuste daquele mês é aceito.

## Relacionamentos (resumo)

```
Empresa 1—N Usuario
Empresa 1—N Setor
Setor 1—N Escala
Usuario 1—N FuncionarioSetor N—1 Setor
FuncionarioSetor N—1 Escala
Usuario 1—N Dispositivo
Setor 1—N Dispositivo (modo relógio)
Usuario 1—N Marcacao N—1 Setor N—1 Dispositivo
Usuario 1—N Justificativa 1—N AjusteMarcacao
Marcacao 0—1 AjusteMarcacao
Usuario 1—N FechamentoPeriodo
```

## Cálculo que atravessa o modelo

A hora que vale nunca é a do celular. Todo aparelho guarda, na última sincronização com o servidor, a diferença entre os dois relógios (`desvio_servidor_segundos`). Cada marcação grava a hora do aparelho e essa diferença, e o servidor deriva `hora_servidor` = `hora_dispositivo` − `desvio_servidor_segundos`. Um relógio adiantado no aparelho, portanto, não altera a hora que entra no espelho — só sinaliza a marcação para análise quando o desvio é grande demais.

Banco local do aplicativo (etapa A02) espelha um subconjunto destas tabelas — `usuario`, `setor`, `escala`, `funcionario_setor` do usuário logado e as `marcacao` recentes — mais uma tabela de controle `sincronizacao` (data/hora da última atualização, desvio do servidor).

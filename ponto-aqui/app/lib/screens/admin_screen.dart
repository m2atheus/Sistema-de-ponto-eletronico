import 'dart:convert';

import 'package:flutter/material.dart';

import '../services/api_service.dart';
import '../services/auth_service.dart';
import 'login_screen.dart';

class AdminScreen extends StatefulWidget {
  const AdminScreen({super.key});

  @override
  State<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends State<AdminScreen> {
  final _auth = AuthService();
  final _api = ApiService();
  final Map<String, List<Map<String, dynamic>>> _dados = {};
  List<Map<String, dynamic>> _empresas = [];
  String? _token;
  String? _perfil;
  String? _empresaSelecionada;
  int _indice = 0;
  bool _carregando = true;
  String? _erro;

  bool get _superadmin => _perfil == 'superadmin';
  bool get _podeEditarUsuarios => _superadmin || _perfil == 'rh';
  bool get _podeEditarSetores =>
      _superadmin || _perfil == 'rh' || _perfil == 'gestor';

  List<_Recurso> get _recursos => [
        if (_superadmin)
          const _Recurso(
            titulo: 'Empresas',
            endpoint: '/empresas',
            colecao: 'empresas',
            chaveTitulo: 'razaoSocial',
            campos: [
              _Campo('razaoSocial', 'Razão social', obrigatorio: true),
              _Campo('cnpj', 'CNPJ'),
              _Campo('contato', 'Contato'),
              _Campo('ativo', 'Empresa ativa',
                  tipo: _TipoCampo.booleano, valorInicial: true),
            ],
          ),
        _Recurso(
          titulo: 'Usuários',
          endpoint: '/usuarios',
          colecao: 'usuarios',
          chaveTitulo: 'nome',
          campos: [
            const _Campo('nome', 'Nome', obrigatorio: true),
            const _Campo('email', 'E-mail', obrigatorio: true),
            const _Campo('login', 'Usuário', obrigatorio: true),
            const _Campo('senha', 'Senha', tipo: _TipoCampo.senha),
            const _Campo('perfil', 'Perfil',
                tipo: _TipoCampo.opcao,
                valorInicial: 'funcionario',
                opcoes: {
                  'rh': 'RH / administrador',
                  'gestor': 'Gestor',
                  'funcionario': 'Funcionário',
                  'usuario_setor': 'Usuário do setor',
                }),
            if (_superadmin) const _Campo('empresaId', 'ID da empresa'),
            const _Campo('ativo', 'Usuário ativo',
                tipo: _TipoCampo.booleano, valorInicial: true),
          ],
          permiteCriar: _podeEditarUsuarios,
          permiteEditar: _podeEditarUsuarios,
        ),
        _Recurso(
          titulo: 'Setores',
          endpoint: '/setores',
          colecao: 'setores',
          chaveTitulo: 'nome',
          campos: [
            const _Campo('nome', 'Nome do setor', obrigatorio: true),
            const _Campo('endereco', 'Endereço'),
            const _Campo('latitude', 'Latitude',
                tipo: _TipoCampo.decimal, obrigatorio: true),
            const _Campo('longitude', 'Longitude',
                tipo: _TipoCampo.decimal, obrigatorio: true),
            const _Campo('raioMetros', 'Raio em metros',
                tipo: _TipoCampo.inteiro, obrigatorio: true),
            const _Campo('ignoraLocalizacao', 'Ignorar localização',
                tipo: _TipoCampo.booleano, valorInicial: false),
            const _Campo('exigeSelfie', 'Exigir selfie',
                tipo: _TipoCampo.booleano, valorInicial: false),
            const _Campo('politicaForaPerimetro', 'Fora do perímetro',
                tipo: _TipoCampo.opcao,
                valorInicial: 'bloquear',
                opcoes: {
                  'bloquear': 'Bloquear',
                  'pendente_analise': 'Pendente de análise',
                }),
            if (_superadmin)
              const _Campo('empresaId', 'ID da empresa', obrigatorio: true),
          ],
          permiteCriar: _podeEditarSetores,
          permiteEditar: _podeEditarSetores,
          permiteExcluir: _podeEditarSetores,
          acaoSecundaria: 'funcionarios',
        ),
        _Recurso(
          titulo: 'Funcionários',
          endpoint: '/funcionarios',
          colecao: 'funcionarios',
          chaveTitulo: 'nome',
          campos: [
            const _Campo('nome', 'Nome', obrigatorio: true),
            const _Campo('email', 'E-mail', obrigatorio: true),
            const _Campo('login', 'Usuário', obrigatorio: true),
            const _Campo('senha', 'Senha', tipo: _TipoCampo.senha),
            const _Campo('matricula', 'Matrícula', obrigatorio: true),
            const _Campo('cargo', 'Cargo', obrigatorio: true),
            if (_superadmin)
              const _Campo('empresaId', 'ID da empresa', obrigatorio: true),
          ],
          permiteCriar: _podeEditarUsuarios,
          permiteEditar: false,
          acaoSecundaria: 'alocacoes',
        ),
        _Recurso(
          titulo: 'Escalas',
          endpoint: '/escalas',
          colecao: 'escalas',
          chaveTitulo: 'nome',
          campos: [
            const _Campo('nome', 'Nome da escala', obrigatorio: true),
            const _Campo('setorId', 'ID do setor', obrigatorio: true),
            const _Campo('modelo', 'Modelo',
                tipo: _TipoCampo.opcao,
                valorInicial: 'comercial_5x2',
                opcoes: {
                  'comercial_5x2': 'Comercial 5x2',
                  'diurno': 'Turno diurno',
                  'ciclo_12x36': 'Ciclo 12x36',
                  'ciclo_24x72': 'Ciclo 24x72',
                }),
            const _Campo('dataReferencia', 'Data de referência (ciclos)'),
            const _Campo('toleranciaMinutos', 'Tolerância em minutos',
                tipo: _TipoCampo.inteiro, valorInicial: 5),
            const _Campo(
              'turnos',
              'Turnos em JSON',
              tipo: _TipoCampo.json,
              obrigatorio: true,
              valorInicial:
                  '[{"diasSemana":[1,2,3,4,5],"horaInicio":"08:00","horaFim":"17:00","intervaloMinutos":60}]',
            ),
            if (_superadmin)
              const _Campo('empresaId', 'ID da empresa', obrigatorio: true),
          ],
          permiteCriar: _podeEditarSetores,
          permiteEditar: _podeEditarSetores,
          permiteExcluir: _podeEditarSetores,
          acaoSecundaria: 'projecao',
        ),
        _Recurso(
          titulo: 'Feriados',
          endpoint: '/feriados',
          colecao: 'feriados',
          chaveTitulo: 'descricao',
          campos: [
            const _Campo('data', 'Data (ISO 8601)', obrigatorio: true),
            const _Campo('descricao', 'Descrição', obrigatorio: true),
            const _Campo('setorId', 'ID do setor'),
            if (_superadmin)
              const _Campo('empresaId', 'ID da empresa', obrigatorio: true),
          ],
          permiteCriar: _podeEditarUsuarios,
          permiteEditar: false,
          permiteExcluir: _podeEditarUsuarios,
        ),
        _Recurso(
          titulo: 'Afastamentos',
          endpoint: '/afastamentos',
          colecao: 'afastamentos',
          chaveTitulo: 'tipo',
          campos: [
            const _Campo('usuarioId', 'ID do funcionário', obrigatorio: true),
            const _Campo('tipo', 'Tipo', obrigatorio: true),
            const _Campo('dataInicio', 'Início (ISO 8601)', obrigatorio: true),
            const _Campo('dataFim', 'Fim (ISO 8601)', obrigatorio: true),
            const _Campo('anexoUrl', 'URL do anexo'),
            if (_superadmin)
              const _Campo('empresaId', 'ID da empresa', obrigatorio: true),
          ],
          permiteCriar: _podeEditarUsuarios,
          permiteEditar: false,
          permiteExcluir: _podeEditarUsuarios,
        ),
        _Recurso(
          titulo: 'Dispositivos',
          endpoint: '/dispositivos',
          colecao: 'dispositivos',
          chaveTitulo: 'identificador',
          campos: [
            const _Campo('identificador', 'Identificador', obrigatorio: true),
            const _Campo('tipo', 'Tipo',
                tipo: _TipoCampo.opcao,
                valorInicial: 'pessoal',
                opcoes: {
                  'pessoal': 'Pessoal',
                  'modo_relogio': 'Relógio de setor',
                }),
            const _Campo('usuarioId', 'ID do usuário', obrigatorio: true),
            const _Campo('setorId', 'ID do setor'),
            const _Campo('status', 'Status',
                tipo: _TipoCampo.opcao,
                valorInicial: 'aguardando',
                opcoes: {
                  'aguardando': 'Aguardando',
                  'ativo': 'Ativo',
                  'bloqueado': 'Bloqueado',
                }),
            if (_superadmin)
              const _Campo('empresaId', 'ID da empresa', obrigatorio: true),
          ],
          permiteCriar: _podeEditarUsuarios,
          permiteEditar: true,
        ),
      ];

  @override
  void initState() {
    super.initState();
    _iniciar();
  }

  Future<void> _iniciar() async {
    final sessao = await _auth.usuarioLogado();
    final token = await _auth.token();
    if (!mounted) return;
    setState(() {
      _token = token;
      _perfil = sessao?['usuario_perfil'] as String?;
    });
    if (_superadmin) await _carregarEmpresas();
    await _carregarRecurso(_recursos[_indice]);
  }

  String _caminho(_Recurso recurso) {
    var caminho = recurso.endpoint;
    if (_superadmin &&
        _empresaSelecionada != null &&
        recurso.endpoint != '/empresas') {
      caminho += '?empresaId=${Uri.encodeQueryComponent(_empresaSelecionada!)}';
    }
    return caminho;
  }

  Future<void> _carregarEmpresas() async {
    try {
      final resposta = await _api.getJson(path: '/empresas', token: _token!);
      final empresas =
          (resposta['empresas'] as List).cast<Map<String, dynamic>>();
      if (!mounted) return;
      setState(() {
        _empresas = empresas;
        _empresaSelecionada ??=
            empresas.isEmpty ? null : empresas.first['id'] as String;
      });
    } on ApiException catch (erro) {
      if (mounted) setState(() => _erro = erro.mensagem);
    }
  }

  Future<void> _carregarRecurso(_Recurso recurso) async {
    if (_token == null) return;
    setState(() {
      _carregando = true;
      _erro = null;
    });
    try {
      final resposta =
          await _api.getJson(path: _caminho(recurso), token: _token!);
      final lista = (resposta[recurso.colecao] as List? ?? const [])
          .cast<Map<String, dynamic>>();
      if (!mounted) return;
      setState(() {
        _dados[recurso.endpoint] = lista;
        _carregando = false;
      });
    } on ApiException catch (erro) {
      if (mounted)
        setState(() {
          _erro = erro.mensagem;
          _carregando = false;
        });
    } catch (_) {
      if (mounted)
        setState(() {
          _erro = 'Não foi possível carregar os dados.';
          _carregando = false;
        });
    }
  }

  void _descartarControladoresDepoisDoDialogo(
      Iterable<TextEditingController> controladores) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      for (final controlador in controladores) {
        controlador.dispose();
      }
    });
  }

  Future<void> _salvar(_Recurso recurso, Map<String, dynamic>? registro) async {
    final campos = recurso.campos;
    final controladores = <String, TextEditingController>{};
    final valores = <String, Object?>{};
    for (final campo in campos) {
      final valor = registro?[campo.chave] ?? campo.valorInicial;
      if (campo.tipo == _TipoCampo.booleano || campo.tipo == _TipoCampo.opcao) {
        valores[campo.chave] = valor;
      } else {
        final texto =
            campo.tipo == _TipoCampo.json && registro?[campo.chave] is List
                ? jsonEncode(registro![campo.chave])
                : valor?.toString() ?? '';
        controladores[campo.chave] = TextEditingController(text: texto);
      }
    }
    if (_superadmin &&
        valores.containsKey('empresaId') == false &&
        campos.any((c) => c.chave == 'empresaId')) {
      controladores['empresaId'] =
          TextEditingController(text: _empresaSelecionada ?? '');
    }
    final formulario = GlobalKey<FormState>();
    var salvando = false;

    final corpo = await showDialog<Map<String, Object?>>(
      context: context,
      builder: (contexto) => StatefulBuilder(
        builder: (contexto, atualizarDialogo) => AlertDialog(
          title: Text(registro == null
              ? 'Novo ${recurso.titulo.toLowerCase()}'
              : 'Editar ${recurso.titulo.toLowerCase()}'),
          content: SizedBox(
            width: 520,
            child: SingleChildScrollView(
              child: Form(
                key: formulario,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: campos.map((campo) {
                    if (campo.tipo == _TipoCampo.booleano) {
                      return SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(campo.rotulo),
                        value: valores[campo.chave] as bool? ?? false,
                        onChanged: (valor) => atualizarDialogo(
                            () => valores[campo.chave] = valor),
                      );
                    }
                    if (campo.tipo == _TipoCampo.opcao) {
                      final opcoes = campo.opcoes!;
                      final valorAtual = valores[campo.chave] as String?;
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: DropdownButtonFormField<String>(
                          initialValue: opcoes.containsKey(valorAtual)
                              ? valorAtual
                              : opcoes.keys.first,
                          decoration: InputDecoration(
                              labelText: campo.rotulo,
                              border: const OutlineInputBorder()),
                          items: opcoes.entries
                              .map((e) => DropdownMenuItem(
                                  value: e.key, child: Text(e.value)))
                              .toList(),
                          onChanged: (valor) => atualizarDialogo(
                              () => valores[campo.chave] = valor),
                        ),
                      );
                    }
                    final controlador = controladores[campo.chave]!;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: TextFormField(
                        controller: controlador,
                        obscureText: campo.tipo == _TipoCampo.senha,
                        maxLines: campo.tipo == _TipoCampo.json ? 6 : 1,
                        keyboardType: switch (campo.tipo) {
                          _TipoCampo.inteiro => TextInputType.number,
                          _TipoCampo.decimal =>
                            const TextInputType.numberWithOptions(
                                decimal: true, signed: true),
                          _ => TextInputType.text,
                        },
                        decoration: InputDecoration(
                            labelText: campo.rotulo,
                            border: const OutlineInputBorder()),
                        validator: campo.obrigatorio &&
                                (campo.chave != 'senha' || registro == null)
                            ? (valor) => (valor == null || valor.trim().isEmpty)
                                ? 'Campo obrigatório'
                                : null
                            : null,
                      ),
                    );
                  }).toList(),
                ),
              ),
            ),
          ),
          actions: [
            TextButton(
                onPressed: salvando ? null : () => Navigator.pop(contexto),
                child: const Text('Cancelar')),
            FilledButton(
              onPressed: salvando
                  ? null
                  : () {
                      if (!formulario.currentState!.validate()) return;
                      final payload = <String, Object?>{...valores};
                      for (final campo in campos.where(
                          (campo) => controladores.containsKey(campo.chave))) {
                        final texto = controladores[campo.chave]!.text.trim();
                        if (texto.isEmpty && !campo.obrigatorio) continue;
                        switch (campo.tipo) {
                          case _TipoCampo.inteiro:
                            payload[campo.chave] = int.tryParse(texto);
                          case _TipoCampo.decimal:
                            payload[campo.chave] =
                                double.tryParse(texto.replaceAll(',', '.'));
                          case _TipoCampo.json:
                            try {
                              payload[campo.chave] = jsonDecode(texto);
                            } catch (_) {
                              formulario.currentState!.validate();
                              return;
                            }
                          default:
                            payload[campo.chave] = texto;
                        }
                      }
                      if (registro != null &&
                          (payload['senha'] as String?)?.isEmpty == true)
                        payload.remove('senha');
                      if (payload['empresaId'] == '')
                        payload.remove('empresaId');
                      atualizarDialogo(() => salvando = true);
                      Navigator.pop(contexto, payload);
                    },
              child: Text(registro == null ? 'Criar' : 'Salvar'),
            ),
          ],
        ),
      ),
    );
    _descartarControladoresDepoisDoDialogo(controladores.values);
    if (corpo == null || _token == null) return;

    try {
      if (registro == null) {
        if (_superadmin && recurso.endpoint != '/empresas')
          corpo['empresaId'] ??= _empresaSelecionada;
        await _api.postJson(
            path: recurso.endpoint, token: _token!, body: corpo);
      } else {
        await _api.patchJson(
            path: '${recurso.endpoint}/${registro['id']}',
            token: _token!,
            body: corpo);
      }
      await _carregarRecurso(recurso);
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Alterações salvas.')));
    } on ApiException catch (erro) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(erro.mensagem)));
    }
  }

  Future<void> _excluir(_Recurso recurso, Map<String, dynamic> registro) async {
    final confirmar = await showDialog<bool>(
      context: context,
      builder: (contexto) => AlertDialog(
        title: const Text('Excluir registro'),
        content: Text('Excluir “${registro[recurso.chaveTitulo]}”?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(contexto, false),
              child: const Text('Cancelar')),
          FilledButton(
              onPressed: () => Navigator.pop(contexto, true),
              child: const Text('Excluir')),
        ],
      ),
    );
    if (confirmar != true || _token == null) return;
    try {
      await _api.deleteJson(
          path: '${recurso.endpoint}/${registro['id']}', token: _token!);
      await _carregarRecurso(recurso);
    } on ApiException catch (erro) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(erro.mensagem)));
    }
  }

  Future<void> _mostrarLista(
      String titulo, String caminho, String colecao) async {
    if (_token == null) return;
    try {
      final resposta = await _api.getJson(path: caminho, token: _token!);
      final itens =
          (resposta[colecao] as List? ?? const []).cast<Map<String, dynamic>>();
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (contexto) => AlertDialog(
          title: Text(titulo),
          content: SizedBox(
            width: 520,
            height: 360,
            child: itens.isEmpty
                ? const Center(child: Text('Nenhum registro encontrado.'))
                : ListView.builder(
                    itemCount: itens.length,
                    itemBuilder: (contexto, indice) {
                      final item = itens[indice];
                      return ListTile(
                        title: Text(item['nome']?.toString() ??
                            item['data']?.toString() ??
                            'Registro'),
                        subtitle: Text(item['matricula']?.toString() ??
                            item['vigenciaInicio']?.toString() ??
                            item['escala']?['nome']?.toString() ??
                            ''),
                      );
                    },
                  ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(contexto),
                child: const Text('Fechar'))
          ],
        ),
      );
    } on ApiException catch (erro) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(erro.mensagem)));
    }
  }

  Future<void> _novaAlocacao(String funcionarioId) async {
    final recurso = _recursos.firstWhere((r) => r.endpoint == '/funcionarios');
    final campos = [
      const _Campo('setorId', 'ID do setor', obrigatorio: true),
      const _Campo('escalaId', 'ID da escala', obrigatorio: true),
      const _Campo('vigenciaInicio', 'Início (ISO 8601)', obrigatorio: true),
      const _Campo('vigenciaFim', 'Fim (opcional)'),
    ];
    final controllers = {
      for (final campo in campos) campo.chave: TextEditingController()
    };
    final form = GlobalKey<FormState>();
    final body = await showDialog<Map<String, Object?>>(
      context: context,
      builder: (contexto) => AlertDialog(
        title: const Text('Nova alocação'),
        content: SizedBox(
          width: 480,
          child: Form(
            key: form,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: campos
                  .map((campo) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: TextFormField(
                          controller: controllers[campo.chave],
                          decoration: InputDecoration(
                              labelText: campo.rotulo,
                              border: const OutlineInputBorder()),
                          validator: campo.obrigatorio
                              ? (valor) => valor == null || valor.trim().isEmpty
                                  ? 'Campo obrigatório'
                                  : null
                              : null,
                        ),
                      ))
                  .toList(),
            ),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(contexto),
              child: const Text('Cancelar')),
          FilledButton(
            onPressed: () {
              if (!form.currentState!.validate()) return;
              Navigator.pop(contexto, {
                for (final campo in campos)
                  campo.chave: controllers[campo.chave]!.text.trim()
              });
            },
            child: const Text('Alocar'),
          ),
        ],
      ),
    );
    _descartarControladoresDepoisDoDialogo(controllers.values);
    if (body == null || _token == null) return;
    body.removeWhere((key, value) => value == '');
    if (_superadmin) body['empresaId'] = _empresaSelecionada;
    try {
      await _api.postJson(
          path: '${recurso.endpoint}/$funcionarioId/alocacoes',
          token: _token!,
          body: body);
      await _carregarRecurso(recurso);
    } on ApiException catch (erro) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(erro.mensagem)));
    }
  }

  Future<void> _projetar(Map<String, dynamic> escala) async {
    if (_token == null) return;
    try {
      final resposta = await _api.getJson(
          path: '/escalas/${escala['id']}/projecao?dias=30', token: _token!);
      await _mostrarListaProjecao(resposta['projecao'] as List? ?? const []);
    } on ApiException catch (erro) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(erro.mensagem)));
    }
  }

  Future<void> _mostrarListaProjecao(List<dynamic> projecao) async {
    if (!mounted) return;
    await showDialog<void>(
      context: context,
      builder: (contexto) => AlertDialog(
        title: const Text('Previsão da escala'),
        content: SizedBox(
          width: 420,
          height: 420,
          child: ListView(
            children: projecao.map((dia) {
              final item = dia as Map<String, dynamic>;
              return ListTile(
                leading: Icon(item['trabalha'] == true
                    ? Icons.work_outline
                    : Icons.bedtime_outlined),
                title: Text(item['data']?.toString() ?? ''),
                subtitle: Text(
                    item['trabalha'] == true ? 'Trabalho previsto' : 'Folga'),
              );
            }).toList(),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(contexto),
              child: const Text('Fechar'))
        ],
      ),
    );
  }

  Future<void> _sair() async {
    await _auth.logout();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
        (route) => false);
  }

  @override
  Widget build(BuildContext context) {
    final recursos = _recursos;
    final indice = _indice.clamp(0, recursos.length - 1);
    final recurso = recursos[indice];
    return Scaffold(
      appBar: AppBar(
        title: Text(recurso.titulo),
        actions: [
          if (_superadmin && _empresas.isNotEmpty)
            DropdownButton<String>(
              value: _empresaSelecionada,
              hint: const Text('Empresa'),
              underline: const SizedBox.shrink(),
              items: _empresas
                  .map((empresa) => DropdownMenuItem(
                        value: empresa['id'] as String,
                        child: Text(
                            empresa['razaoSocial']?.toString() ?? 'Empresa'),
                      ))
                  .toList(),
              onChanged: (valor) async {
                setState(() => _empresaSelecionada = valor);
                await _carregarRecurso(recurso);
              },
            ),
          IconButton(
              onPressed: _sair,
              tooltip: 'Sair',
              icon: const Icon(Icons.logout)),
        ],
      ),
      body: _carregando
          ? const Center(child: CircularProgressIndicator())
          : _erro != null
              ? Center(child: Text(_erro!))
              : _construirLista(recurso),
      floatingActionButton: recurso.permiteCriar
          ? FloatingActionButton.extended(
              onPressed: () => _salvar(recurso, null),
              icon: const Icon(Icons.add),
              label: Text('Novo ${recurso.titulo.toLowerCase()}'),
            )
          : null,
      bottomNavigationBar: NavigationBar(
        selectedIndex: indice,
        onDestinationSelected: (valor) async {
          setState(() => _indice = valor);
          await _carregarRecurso(recursos[valor]);
        },
        destinations: recursos
            .map((recurso) => NavigationDestination(
                  icon: Icon(recurso.icone),
                  label: recurso.titulo,
                ))
            .toList(),
      ),
    );
  }

  Widget _construirLista(_Recurso recurso) {
    final itens = _dados[recurso.endpoint] ?? const [];
    if (itens.isEmpty) {
      return Center(
          child: Text('Nenhum registro em ${recurso.titulo.toLowerCase()}.'));
    }
    return RefreshIndicator(
      onRefresh: () => _carregarRecurso(recurso),
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 88),
        itemCount: itens.length,
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemBuilder: (context, indice) {
          final item = itens[indice];
          final acoes = <Widget>[];
          if (recurso.acaoSecundaria == 'alocacoes') {
            acoes.add(IconButton(
              tooltip: 'Ver histórico de setores',
              icon: const Icon(Icons.assignment_ind_outlined),
              onPressed: () => _mostrarLista(
                  'Histórico de ${item['nome']}',
                  '/funcionarios/${item['id']}/alocacoes${_superadmin ? '?empresaId=$_empresaSelecionada' : ''}',
                  'alocacoes'),
            ));
            acoes.add(IconButton(
              tooltip: 'Nova alocação',
              icon: const Icon(Icons.add_business_outlined),
              onPressed: () => _novaAlocacao(item['id'] as String),
            ));
          }
          if (recurso.acaoSecundaria == 'funcionarios') {
            acoes.add(IconButton(
              tooltip: 'Funcionários atualmente alocados',
              icon: const Icon(Icons.groups_outlined),
              onPressed: () => _mostrarLista(
                  'Funcionários de ${item['nome']}',
                  '/funcionarios/setor/${item['id']}${_superadmin ? '?empresaId=$_empresaSelecionada' : ''}',
                  'funcionarios'),
            ));
          }
          if (recurso.acaoSecundaria == 'projecao') {
            acoes.add(IconButton(
                tooltip: 'Projetar escala',
                icon: const Icon(Icons.calendar_month),
                onPressed: () => _projetar(item)));
          }
          if (recurso.permiteEditar) {
            acoes.add(IconButton(
                tooltip: 'Editar',
                icon: const Icon(Icons.edit_outlined),
                onPressed: () => _salvar(recurso, item)));
          }
          if (recurso.permiteExcluir) {
            acoes.add(IconButton(
                tooltip: 'Excluir',
                icon: const Icon(Icons.delete_outline),
                onPressed: () => _excluir(recurso, item)));
          }
          return ListTile(
            title: Text(item[recurso.chaveTitulo]?.toString() ?? 'Registro'),
            subtitle: Text(_subtitulo(recurso, item)),
            trailing: acoes.isEmpty ? null : Wrap(spacing: 2, children: acoes),
          );
        },
      ),
    );
  }

  String _subtitulo(_Recurso recurso, Map<String, dynamic> item) =>
      switch (recurso.endpoint) {
        '/empresas' =>
          '${item['contato'] ?? 'Sem contato'} · ${item['ativo'] == true ? 'Ativa' : 'Inativa'}',
        '/usuarios' =>
          '${item['email'] ?? ''} · ${item['perfil'] ?? ''} · ${item['ativo'] == true ? 'Ativo' : 'Inativo'}',
        '/setores' =>
          '${item['endereco'] ?? 'Sem endereço'} · raio ${item['raioMetros']} m · ${item['funcionariosAtivos'] ?? 0} ativos',
        '/funcionarios' =>
          '${item['matricula'] ?? ''} · ${item['cargo'] ?? ''}',
        '/escalas' =>
          '${item['modelo'] ?? ''} · ${item['setor']?['nome'] ?? ''}',
        '/feriados' =>
          '${item['data'] ?? ''} · ${item['setor']?['nome'] ?? 'Global'}',
        '/afastamentos' =>
          '${item['usuario']?['nome'] ?? item['usuarioId'] ?? ''} · ${item['dataInicio'] ?? ''} até ${item['dataFim'] ?? ''}',
        '/dispositivos' =>
          '${item['tipo'] ?? ''} · ${item['status'] ?? ''} · ${item['usuario']?['nome'] ?? item['setor']?['nome'] ?? ''}',
        _ => '',
      };
}

enum _TipoCampo { texto, senha, inteiro, decimal, booleano, opcao, json }

class _Campo {
  const _Campo(
    this.chave,
    this.rotulo, {
    this.tipo = _TipoCampo.texto,
    this.obrigatorio = false,
    this.valorInicial,
    this.opcoes,
  });

  final String chave;
  final String rotulo;
  final _TipoCampo tipo;
  final bool obrigatorio;
  final Object? valorInicial;
  final Map<String, String>? opcoes;
}

class _Recurso {
  const _Recurso({
    required this.titulo,
    required this.endpoint,
    required this.colecao,
    required this.chaveTitulo,
    required this.campos,
    this.permiteCriar = true,
    this.permiteEditar = true,
    this.permiteExcluir = false,
    this.acaoSecundaria,
  });

  final String titulo;
  final String endpoint;
  final String colecao;
  final String chaveTitulo;
  final List<_Campo> campos;
  final bool permiteCriar;
  final bool permiteEditar;
  final bool permiteExcluir;
  final String? acaoSecundaria;

  IconData get icone => switch (endpoint) {
        '/empresas' => Icons.business_outlined,
        '/usuarios' => Icons.manage_accounts_outlined,
        '/setores' => Icons.place_outlined,
        '/funcionarios' => Icons.badge_outlined,
        _ => Icons.calendar_month_outlined,
      };
}

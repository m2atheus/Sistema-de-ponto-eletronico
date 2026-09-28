import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';

import 'api_service.dart';
import 'local_db_service.dart';

/// Tarefa A01 — login uma vez com rede, sessão sobrevive offline depois.
class AuthService {
  AuthService({ApiService? api, LocalDbService? localDb})
      : _api = api ?? ApiService(),
        _localDb = localDb ?? LocalDbService();

  final ApiService _api;
  final LocalDbService _localDb;
  final _armazenamentoSeguro = const FlutterSecureStorage();

  static const _chaveToken = 'ponto_aqui_token';
  static const _chaveIdentificadorDispositivo = 'ponto_aqui_identificador_dispositivo';

  Future<String> _identificadorDispositivo() async {
    var identificador = await _armazenamentoSeguro.read(key: _chaveIdentificadorDispositivo);
    if (identificador == null) {
      identificador = const Uuid().v4();
      await _armazenamentoSeguro.write(key: _chaveIdentificadorDispositivo, value: identificador);
    }
    return identificador;
  }

  /// true quando já existe uma sessão salva — é o que permite abrir o app
  /// sem rede e ir direto para a tela de bater ponto.
  Future<bool> sessaoAtiva() async {
    final token = await _armazenamentoSeguro.read(key: _chaveToken);
    final sessao = await _localDb.obterSessao();
    return token != null && sessao != null;
  }

  Future<Map<String, Object?>?> usuarioLogado() => _localDb.obterSessao();

  Future<void> login({required String email, required String senha}) async {
    final identificador = await _identificadorDispositivo();

    final resultado = await _api.login(
      email: email,
      senha: senha,
      identificadorDispositivo: identificador,
    );

    final token = resultado['token'] as String;
    final usuario = resultado['usuario'] as Map<String, dynamic>;

    await _armazenamentoSeguro.write(key: _chaveToken, value: token);
    await _localDb.salvarSessao(
      token: token,
      usuarioId: usuario['id'] as String,
      usuarioNome: usuario['nome'] as String,
      usuarioPerfil: usuario['perfil'] as String,
    );
  }

  Future<String?> token() => _armazenamentoSeguro.read(key: _chaveToken);

  /// Token vencido: manda para o login, mas preserva a fila de marcações
  /// ainda não enviadas — só a sessão é limpa, não os dados sincronizados
  /// nem a fila. Diferente do logout manual, que apaga tudo.
  Future<void> invalidarSessaoPorTokenExpirado() async {
    await _armazenamentoSeguro.delete(key: _chaveToken);
    final database = await _localDb.db;
    await database.delete('sessao');
  }

  /// Retorna quantas marcações estão na fila sem envio — usado pela tela
  /// de logout para avisar o usuário antes de confirmar.
  Future<int> quantidadeMarcacoesPendentes() async {
    final pendentes = await _localDb.marcacoesPendentes();
    return pendentes.length;
  }

  /// Logout confirmado pelo usuário: apaga token e todos os dados locais,
  /// inclusive marcações já enviadas — é o que o critério de aceite A02 pede.
  Future<void> logout() async {
    await _armazenamentoSeguro.delete(key: _chaveToken);
    await _localDb.limparTudo();
  }
}

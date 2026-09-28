import 'dart:convert';
import 'package:http/http.dart' as http;

/// Fala com a API. Nada aqui decide o que fazer se a rede faltar — isso é
/// responsabilidade de quem chama (SyncService, AuthService), que sempre
/// sabe que a chamada pode simplesmente não acontecer.
class ApiService {
  ApiService({this.baseUrl = 'https://api.pontoaqui.exemplo.com'});

  final String baseUrl;

  Future<Map<String, dynamic>> login({
    required String email,
    required String senha,
    required String identificadorDispositivo,
  }) async {
    final resposta = await http.post(
      Uri.parse('$baseUrl/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'email': email,
        'senha': senha,
        'identificadorDispositivo': identificadorDispositivo,
      }),
    );

    if (resposta.statusCode != 200) {
      // Erro genérico de propósito (critério de aceite A01): a tela não
      // diz qual dos dois campos falhou.
      throw ApiException('Não foi possível entrar. Confira seus dados e tente de novo.');
    }

    return jsonDecode(resposta.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> sincronizar({required String token}) async {
    final resposta = await http.get(
      Uri.parse('$baseUrl/sync'),
      headers: {'Authorization': 'Bearer $token'},
    );

    if (resposta.statusCode == 401) {
      throw TokenInvalidoException();
    }
    if (resposta.statusCode != 200) {
      throw ApiException('Não foi possível atualizar os dados agora.');
    }

    return jsonDecode(resposta.body) as Map<String, dynamic>;
  }

  Future<void> enviarLoteMarcacoes({
    required String token,
    required List<Map<String, dynamic>> marcacoes,
  }) async {
    final resposta = await http.post(
      Uri.parse('$baseUrl/marcacoes/lote'),
      headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $token'},
      body: jsonEncode({'marcacoes': marcacoes}),
    );

    if (resposta.statusCode == 401) {
      throw TokenInvalidoException();
    }
    if (resposta.statusCode != 200) {
      throw ApiException('Não foi possível enviar as marcações agora.');
    }
  }
}

class ApiException implements Exception {
  ApiException(this.mensagem);
  final String mensagem;
}

/// Token vencido ou dispositivo desligado (login em outro aparelho).
/// Quem recebe isso deve mandar o usuário para a tela de login sem apagar
/// a fila local de marcações.
class TokenInvalidoException implements Exception {}

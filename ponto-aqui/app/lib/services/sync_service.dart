import 'api_service.dart';
import 'auth_service.dart';
import 'connectivity_service.dart';
import 'local_db_service.dart';

/// Tarefa A02 — baixa e grava localmente o que o app precisa para
/// funcionar inteiro sem consultar nada: dados do usuário, setor, política,
/// escala do período e marcações recentes, além da hora do servidor.
class SyncService {
  SyncService({
    ApiService? api,
    LocalDbService? localDb,
    AuthService? auth,
    ConnectivityService? conectividade,
  })  : _api = api ?? ApiService(),
        _localDb = localDb ?? LocalDbService(),
        _auth = auth ?? AuthService(),
        _conectividade = conectividade ?? ConnectivityService();

  final ApiService _api;
  final LocalDbService _localDb;
  final AuthService _auth;
  final ConnectivityService _conectividade;

  /// Chamada na tela de abertura e no botão "atualizar agora".
  /// Sem internet, simplesmente não faz nada — quem chamou segue com o
  /// que já está no banco local, sem erro.
  Future<ResultadoSincronizacao> sincronizarSePossivel() async {
    final temInternet = await _conectividade.temInternet();
    if (!temInternet) {
      return ResultadoSincronizacao.semInternet();
    }

    final token = await _auth.token();
    if (token == null) {
      return ResultadoSincronizacao.semSessao();
    }

    try {
      final dados = await _api.sincronizar(token: token);

      final horaServidor = DateTime.parse(dados['horaServidor'] as String);
      final alocacoes = (dados['alocacoes'] as List).cast<Map<String, dynamic>>();
      final marcacoes = (dados['marcacoesRecentes'] as List).cast<Map<String, dynamic>>();

      await _localDb.gravarSincronizacao(
        horaServidor: horaServidor,
        setores: alocacoes.map((a) => _mapaSetor(a['setor'])).toList(),
        escalas: alocacoes.map((a) => _mapaEscala(a['escala'])).toList(),
        alocacoes: alocacoes.map(_mapaAlocacao).toList(),
        marcacoesRecentes: marcacoes.map(_mapaMarcacao).toList(),
      );

      return ResultadoSincronizacao.sucesso();
    } on TokenInvalidoException {
      await _auth.invalidarSessaoPorTokenExpirado();
      return ResultadoSincronizacao.tokenInvalido();
    } on ApiException {
      // Falhou no meio (rede caiu durante a chamada, por exemplo): como a
      // gravação é feita numa única transação, o banco local continua com
      // a última sincronização completa, nunca com dado pela metade.
      return ResultadoSincronizacao.semInternet();
    }
  }

  Future<DateTime?> ultimaAtualizacaoEm() => _localDb.ultimaSincronizacaoEm();

  Map<String, Object?> _mapaSetor(Map<String, dynamic> s) => {
        'id': s['id'],
        'nome': s['nome'],
        'latitude': s['latitude'],
        'longitude': s['longitude'],
        'raio_metros': s['raioMetros'],
        'ignora_localizacao': (s['ignoraLocalizacao'] as bool) ? 1 : 0,
      };

  Map<String, Object?> _mapaEscala(Map<String, dynamic> e) => {
        'id': e['id'],
        'nome': e['nome'],
        'tipo': e['tipo'],
        'carga_diaria_minutos': e['cargaDiariaMinutos'],
        'tolerancia_minutos': e['toleranciaMinutos'],
        'regra_json': e['regra'].toString(),
      };

  Map<String, Object?> _mapaAlocacao(Map<String, dynamic> a) => {
        'id': '${a['setor']['id']}-${a['escala']['id']}',
        'setor_id': a['setor']['id'],
        'escala_id': a['escala']['id'],
        'vigencia_inicio': a['vigenciaInicio'],
        'vigencia_fim': a['vigenciaFim'],
      };

  Map<String, Object?> _mapaMarcacao(Map<String, dynamic> m) => {
        'id_local': m['idLocal'],
        'id_servidor': m['id'],
        'setor_id': m['setorId'],
        'tipo': m['tipo'],
        'hora_dispositivo': m['horaDispositivo'],
        'desvio_servidor_segundos': m['desvioServidorSegundos'],
        'latitude': m['latitude'],
        'longitude': m['longitude'],
        'distancia_metros': m['distanciaMetros'],
        'dentro_perimetro': (m['dentroPerimetro'] == true) ? 1 : 0,
        'selfie_path': null,
        'origem': m['origem'],
        'enviada': 1,
      };
}

enum StatusSincronizacao { sucesso, semInternet, semSessao, tokenInvalido }

class ResultadoSincronizacao {
  ResultadoSincronizacao._(this.status);

  final StatusSincronizacao status;

  factory ResultadoSincronizacao.sucesso() => ResultadoSincronizacao._(StatusSincronizacao.sucesso);
  factory ResultadoSincronizacao.semInternet() =>
      ResultadoSincronizacao._(StatusSincronizacao.semInternet);
  factory ResultadoSincronizacao.semSessao() =>
      ResultadoSincronizacao._(StatusSincronizacao.semSessao);
  factory ResultadoSincronizacao.tokenInvalido() =>
      ResultadoSincronizacao._(StatusSincronizacao.tokenInvalido);
}

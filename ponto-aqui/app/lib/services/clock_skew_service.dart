import 'local_db_service.dart';

class ClockSkewService {
  ClockSkewService({LocalDbService? localDb})
      : _localDb = localDb ?? LocalDbService();

  final LocalDbService _localDb;

  Future<int?> desvioSegundos() => _localDb.desvioServidorSegundos();

  Future<String> aviso() async {
    final desvio = await desvioSegundos();
    if (desvio == null) return 'O desvio de relógio é desconhecido.';
    if (desvio.abs() > 300) {
      return 'O relógio do aparelho está fora da hora certa e a marcação poderá passar por análise.';
    }
    return '';
  }
}

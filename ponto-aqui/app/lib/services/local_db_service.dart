import 'package:flutter/foundation.dart' show defaultTargetPlatform, kIsWeb, TargetPlatform;
import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart' as sqflite_ffi;
import 'package:sqflite_common_ffi_web/sqflite_ffi_web.dart' as sqflite_ffi_web;

/// Banco local do aparelho. É o que sustenta a Tarefa A01 (sessão sobrevive
/// offline) e a A02 (dados de usuário, setor, escala e marcações recentes
/// guardados para uso sem rede).
class LocalDbService {
  static final LocalDbService _instancia = LocalDbService._interno();
  factory LocalDbService() => _instancia;
  LocalDbService._interno();

  Database? _db;

  Future<Database> get db async {
    _db ??= await _abrir();
    return _db!;
  }

  Future<Database> _abrir() async {
    if (kIsWeb) {
      databaseFactory = sqflite_ffi_web.databaseFactoryFfiWeb;
    } else if (defaultTargetPlatform == TargetPlatform.windows) {
      sqflite_ffi.sqfliteFfiInit();
      databaseFactory = sqflite_ffi.databaseFactoryFfi;
    }

    final caminho = kIsWeb ? 'ponto_aqui.db' : join(await getDatabasesPath(), 'ponto_aqui.db');
    return openDatabase(
      caminho,
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE sessao (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            token TEXT,
            usuario_id TEXT,
            usuario_nome TEXT,
            usuario_perfil TEXT
          )
        ''');

        await db.execute('''
          CREATE TABLE sincronizacao (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            ultima_sincronizacao_em TEXT,
            desvio_servidor_segundos INTEGER
          )
        ''');

        await db.execute('''
          CREATE TABLE setor (
            id TEXT PRIMARY KEY,
            nome TEXT,
            latitude REAL,
            longitude REAL,
            raio_metros INTEGER,
            ignora_localizacao INTEGER
          )
        ''');

        await db.execute('''
          CREATE TABLE escala (
            id TEXT PRIMARY KEY,
            nome TEXT,
            tipo TEXT,
            carga_diaria_minutos INTEGER,
            tolerancia_minutos INTEGER,
            regra_json TEXT
          )
        ''');

        await db.execute('''
          CREATE TABLE alocacao (
            id TEXT PRIMARY KEY,
            setor_id TEXT,
            escala_id TEXT,
            vigencia_inicio TEXT,
            vigencia_fim TEXT
          )
        ''');

        await db.execute('''
          CREATE TABLE marcacao (
            id_local TEXT PRIMARY KEY,
            id_servidor TEXT,
            setor_id TEXT,
            tipo TEXT,
            hora_dispositivo TEXT,
            desvio_servidor_segundos INTEGER,
            latitude REAL,
            longitude REAL,
            distancia_metros REAL,
            dentro_perimetro INTEGER,
            selfie_path TEXT,
            origem TEXT,
            enviada INTEGER DEFAULT 0
          )
        ''');
      },
    );
  }

  // --- sessão -------------------------------------------------------------

  Future<void> salvarSessao({
    required String token,
    required String usuarioId,
    required String usuarioNome,
    required String usuarioPerfil,
  }) async {
    final database = await db;
    await database.insert(
      'sessao',
      {
        'id': 1,
        'token': token,
        'usuario_id': usuarioId,
        'usuario_nome': usuarioNome,
        'usuario_perfil': usuarioPerfil,
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<Map<String, Object?>?> obterSessao() async {
    final database = await db;
    final linhas = await database.query('sessao', where: 'id = 1');
    return linhas.isEmpty ? null : linhas.first;
  }

  /// Limpa tudo: sessão, dados sincronizados e marcações já enviadas.
  /// Marcações ainda não enviadas NÃO são apagadas por engano — quem chama
  /// isso deve confirmar antes que não há pendência (ver AuthService.logout).
  Future<void> limparTudo() async {
    final database = await db;
    await database.transaction((txn) async {
      await txn.delete('sessao');
      await txn.delete('sincronizacao');
      await txn.delete('setor');
      await txn.delete('escala');
      await txn.delete('alocacao');
      await txn.delete('marcacao', where: 'enviada = 1');
    });
  }

  // --- sincronização --------------------------------------------------------

  Future<DateTime?> ultimaSincronizacaoEm() async {
    final database = await db;
    final linhas = await database.query('sincronizacao', where: 'id = 1');
    if (linhas.isEmpty || linhas.first['ultima_sincronizacao_em'] == null) return null;
    return DateTime.parse(linhas.first['ultima_sincronizacao_em'] as String);
  }

  Future<int> desvioServidorSegundos() async {
    final database = await db;
    final linhas = await database.query('sincronizacao', where: 'id = 1');
    if (linhas.isEmpty || linhas.first['desvio_servidor_segundos'] == null) return 0;
    return linhas.first['desvio_servidor_segundos'] as int;
  }

  /// Grava tudo dentro de uma única transação: se a atualização for
  /// interrompida no meio, nada fica pela metade — ou entra tudo, ou nada.
  Future<void> gravarSincronizacao({
    required DateTime horaServidor,
    required List<Map<String, Object?>> setores,
    required List<Map<String, Object?>> escalas,
    required List<Map<String, Object?>> alocacoes,
    required List<Map<String, Object?>> marcacoesRecentes,
  }) async {
    final database = await db;
    final desvio = DateTime.now().difference(horaServidor).inSeconds;

    await database.transaction((txn) async {
      await txn.delete('setor');
      await txn.delete('escala');
      await txn.delete('alocacao');
      // marcações recentes do servidor só preenchem histórico; as pendentes
      // de envio (enviada = 0) deste aparelho são preservadas.
      await txn.delete('marcacao', where: 'enviada = 1');

      for (final s in setores) {
        await txn.insert('setor', s, conflictAlgorithm: ConflictAlgorithm.replace);
      }
      for (final e in escalas) {
        await txn.insert('escala', e, conflictAlgorithm: ConflictAlgorithm.replace);
      }
      for (final a in alocacoes) {
        await txn.insert('alocacao', a, conflictAlgorithm: ConflictAlgorithm.replace);
      }
      for (final m in marcacoesRecentes) {
        await txn.insert('marcacao', m, conflictAlgorithm: ConflictAlgorithm.replace);
      }

      await txn.insert(
        'sincronizacao',
        {
          'id': 1,
          'ultima_sincronizacao_em': DateTime.now().toIso8601String(),
          'desvio_servidor_segundos': desvio,
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    });
  }

  // --- fila de marcações offline -------------------------------------------

  Future<void> enfileirarMarcacao(Map<String, Object?> marcacao) async {
    final database = await db;
    await database.insert('marcacao', marcacao, conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<List<Map<String, Object?>>> marcacoesPendentes() async {
    final database = await db;
    return database.query('marcacao', where: 'enviada = 0');
  }

  Future<bool> haPendencias() async {
    final pendentes = await marcacoesPendentes();
    return pendentes.isNotEmpty;
  }

  Future<void> marcarComoEnviada(String idLocal) async {
    final database = await db;
    await database.update('marcacao', {'enviada': 1}, where: 'id_local = ?', whereArgs: [idLocal]);
  }
}

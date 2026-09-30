import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:uuid/uuid.dart';

import '../services/auth_service.dart';
import '../services/connectivity_service.dart';
import '../services/clock_skew_service.dart';
import '../services/local_db_service.dart';
import '../services/location_service.dart';
import '../services/sync_service.dart';
import 'login_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _auth = AuthService();
  final _sync = SyncService();
  final _conectividade = ConnectivityService();
  final _localDb = LocalDbService();
  final _localizacao = LocationService();
  final _clockSkew = ClockSkewService();

  Map<String, Object?>? _sessao;
  Map<String, Object?>? _setor;
  List<Map<String, Object?>> _marcacoesHoje = [];
  DateTime? _ultimaAtualizacao;
  bool _semInternet = false;
  bool _atualizando = false;
  bool _registrando = false;

  @override
  void initState() {
    super.initState();
    _carregar();
  }

  Future<void> _carregar() async {
    final sessao = await _auth.usuarioLogado();
    final ultima = await _sync.ultimaAtualizacaoEm();
    final temInternet = await _conectividade.temInternet();
    final setor = await _localDb.setorPrincipal();
    final marcacoes = await _localDb.marcacoesDoDia(DateTime.now());
    if (!mounted) return;
    setState(() {
      _sessao = sessao;
      _setor = setor;
      _marcacoesHoje = marcacoes;
      _ultimaAtualizacao = ultima;
      _semInternet = !temInternet;
    });
  }

  String get _proximoTipo {
    const tipos = ['entrada', 'saida_intervalo', 'retorno_intervalo', 'saida'];
    return tipos[_marcacoesHoje.length % tipos.length];
  }

  String _rotuloTipo(String tipo) => switch (tipo) {
        'entrada' => 'Entrada',
        'saida_intervalo' => 'Saída para intervalo',
        'retorno_intervalo' => 'Retorno do intervalo',
        'saida' => 'Saída',
        _ => tipo,
      };

  Future<void> _registrarPonto() async {
    if (_registrando) return;
    final setor = _setor;
    if (setor == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Nenhum setor sincronizado para registrar o ponto.')),
      );
      return;
    }
    if (setor['exige_selfie'] == 1) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text(
                'Este setor exige selfie, mas a captura ainda não está disponível.')),
      );
      return;
    }

    setState(() => _registrando = true);
    final horaDispositivo = DateTime.now();
    final ignoraLocalizacao = setor['ignora_localizacao'] == 1;
    Localizacao? localizacao;
    double? distancia;
    if (!ignoraLocalizacao) {
      localizacao = await _localizacao.capturar();
      if (localizacao != null) {
        distancia = LocationService.distanciaMetros(
          latitudeA: localizacao.latitude,
          longitudeA: localizacao.longitude,
          latitudeB: setor['latitude'] as double,
          longitudeB: setor['longitude'] as double,
        );
      }
    }

    final raio = setor['raio_metros'] as int;
    final foraDoPerimetro = !ignoraLocalizacao &&
        (localizacao == null || distancia == null || distancia > raio);
    final politica = setor['politica_fora_perimetro'] as String? ?? 'bloquear';
    if (foraDoPerimetro && localizacao == null && politica == 'bloquear') {
      await _mostrarAviso(
          'Ative o GPS e conceda a permissão de localização para registrar o ponto.');
      if (mounted) setState(() => _registrando = false);
      return;
    }
    if (foraDoPerimetro && politica == 'bloquear') {
      await _mostrarAviso(
          'Você está fora do perímetro permitido para este setor.');
      if (mounted) setState(() => _registrando = false);
      return;
    }

    final avisoRelogio = await _clockSkew.aviso();
    if (!mounted) return;
    final distanciaTexto = ignoraLocalizacao
        ? 'Localização ignorada pela política do setor.'
        : distancia == null
            ? 'Distância indisponível.'
            : 'Distância: ${distancia.round()} m (raio: $raio m).';
    final confirmar = await showDialog<bool>(
      context: context,
      builder: (contexto) => AlertDialog(
        title: Text(_rotuloTipo(_proximoTipo)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
                'Horário que será registrado: ${DateFormat('dd/MM/yyyy HH:mm:ss').format(horaDispositivo)}'),
            const SizedBox(height: 12),
            Text(distanciaTexto),
            if (foraDoPerimetro) ...[
              const SizedBox(height: 8),
              const Text(
                  'Fora do perímetro. A marcação será enviada como pendente de análise.'),
            ],
            if (avisoRelogio.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(avisoRelogio, style: const TextStyle(color: Colors.orange)),
            ],
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(contexto, false),
              child: const Text('Cancelar')),
          FilledButton(
              onPressed: () => Navigator.pop(contexto, true),
              child: const Text('Confirmar')),
        ],
      ),
    );
    if (confirmar != true) {
      if (mounted) setState(() => _registrando = false);
      return;
    }

    final desvio = await _clockSkew.desvioSegundos();
    await _localDb.enfileirarMarcacao({
      'id_local': const Uuid().v4(),
      'id_servidor': null,
      'setor_id': setor['id'],
      'tipo': _proximoTipo,
      'hora_dispositivo': horaDispositivo.toIso8601String(),
      'desvio_servidor_segundos': desvio,
      'latitude': localizacao?.latitude,
      'longitude': localizacao?.longitude,
      'distancia_metros': distancia,
      'dentro_perimetro': ignoraLocalizacao ? null : (foraDoPerimetro ? 0 : 1),
      'selfie_path': null,
      'origem': 'offline_sincronizada',
      'enviada': 0,
    });
    final envio = await _sync.enviarPendenciasSePossivel();
    if (!mounted) return;
    if (envio.status == StatusSincronizacao.tokenInvalido) {
      Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const LoginScreen()));
      return;
    }
    await _carregar();
    if (!mounted) return;
    setState(() => _registrando = false);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Ponto registrado neste aparelho.')),
    );
  }

  Future<void> _mostrarAviso(String mensagem) async {
    await showDialog<void>(
      context: context,
      builder: (contexto) => AlertDialog(
        content: Text(mensagem),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(contexto),
              child: const Text('Entendi'))
        ],
      ),
    );
  }

  Future<void> _atualizarAgora() async {
    setState(() => _atualizando = true);
    final resultado = await _sync.sincronizarSePossivel();

    if (!mounted) return;

    if (resultado.status == StatusSincronizacao.tokenInvalido) {
      // Token vencido: volta para o login sem apagar a fila de marcações.
      Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const LoginScreen()));
      return;
    }

    await _carregar();
    if (!mounted) return;
    setState(() => _atualizando = false);

    final mensagem = switch (resultado.status) {
      StatusSincronizacao.sucesso => 'Dados atualizados.',
      StatusSincronizacao.semInternet =>
        'Sem internet — usando os dados já salvos.',
      _ => 'Não foi possível atualizar agora.',
    };
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(mensagem)));
  }

  Future<void> _sair() async {
    final pendencias = await _auth.quantidadeMarcacoesPendentes();

    if (!mounted) return;

    final confirmar = await showDialog<bool>(
      context: context,
      builder: (contexto) => AlertDialog(
        title: const Text('Sair da conta'),
        content: Text(
          pendencias > 0
              ? 'Você tem $pendencias marcação(ões) ainda não enviada(s). '
                  'Saindo agora, elas continuam guardadas neste aparelho até o próximo envio. Quer mesmo sair?'
              : 'Tem certeza que quer sair da conta?',
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(contexto, false),
              child: const Text('Cancelar')),
          FilledButton(
              onPressed: () => Navigator.pop(contexto, true),
              child: const Text('Sair')),
        ],
      ),
    );

    if (confirmar != true) return;

    await _auth.logout();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    final nome = _sessao?['usuario_nome'] as String? ?? '';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Ponto Aqui'),
        actions: [
          IconButton(
              onPressed: _sair,
              icon: const Icon(Icons.logout),
              tooltip: 'Sair'),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Olá, $nome', style: const TextStyle(fontSize: 18)),
              const SizedBox(height: 8),
              if (_semInternet)
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.orange.shade50,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.wifi_off, size: 18, color: Colors.orange),
                      SizedBox(width: 8),
                      Expanded(
                          child: Text(
                              'Sem internet no momento. Usando os dados salvos no aparelho.')),
                    ],
                  ),
                ),
              const SizedBox(height: 16),
              Text(
                _ultimaAtualizacao == null
                    ? 'Ainda sem dados sincronizados.'
                    : 'Última atualização: ${DateFormat('dd/MM/yyyy HH:mm').format(_ultimaAtualizacao!)}',
                style: const TextStyle(color: Colors.black54),
              ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: _atualizando ? null : _atualizarAgora,
                icon: const Icon(Icons.refresh),
                label:
                    Text(_atualizando ? 'Atualizando...' : 'Atualizar agora'),
              ),
              const Spacer(),
              if (_setor != null) ...[
                Text('Próxima marcação: ${_rotuloTipo(_proximoTipo)}',
                    style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 12),
                SizedBox(
                  height: 64,
                  child: FilledButton.icon(
                    onPressed: _registrando ? null : _registrarPonto,
                    icon: _registrando
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.touch_app),
                    label:
                        Text(_registrando ? 'Registrando...' : 'Bater ponto'),
                  ),
                ),
                const SizedBox(height: 16),
                Text('Marcações de hoje',
                    style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                ..._marcacoesHoje.map(
                  (marcacao) => ListTile(
                    dense: true,
                    leading: const Icon(Icons.check_circle_outline),
                    title: Text(_rotuloTipo(marcacao['tipo'] as String)),
                    subtitle: Text(DateFormat('HH:mm:ss').format(DateTime.parse(
                        marcacao['hora_dispositivo'] as String))),
                    trailing: marcacao['enviada'] == 1
                        ? const Icon(Icons.cloud_done)
                        : const Icon(Icons.cloud_off),
                  ),
                ),
              ] else
                const Center(
                    child: Text(
                        'Sincronize os dados do setor para registrar o ponto.')),
              const Spacer(),
            ],
          ),
        ),
      ),
    );
  }
}

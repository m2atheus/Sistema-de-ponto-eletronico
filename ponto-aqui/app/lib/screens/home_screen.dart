import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../services/auth_service.dart';
import '../services/connectivity_service.dart';
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

  Map<String, Object?>? _sessao;
  DateTime? _ultimaAtualizacao;
  bool _semInternet = false;
  bool _atualizando = false;

  @override
  void initState() {
    super.initState();
    _carregar();
  }

  Future<void> _carregar() async {
    final sessao = await _auth.usuarioLogado();
    final ultima = await _sync.ultimaAtualizacaoEm();
    final temInternet = await _conectividade.temInternet();
    if (!mounted) return;
    setState(() {
      _sessao = sessao;
      _ultimaAtualizacao = ultima;
      _semInternet = !temInternet;
    });
  }

  Future<void> _atualizarAgora() async {
    setState(() => _atualizando = true);
    final resultado = await _sync.sincronizarSePossivel();

    if (!mounted) return;

    if (resultado.status == StatusSincronizacao.tokenInvalido) {
      // Token vencido: volta para o login sem apagar a fila de marcações.
      Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const LoginScreen()));
      return;
    }

    await _carregar();
    setState(() => _atualizando = false);

    final mensagem = switch (resultado.status) {
      StatusSincronizacao.sucesso => 'Dados atualizados.',
      StatusSincronizacao.semInternet => 'Sem internet — usando os dados já salvos.',
      _ => 'Não foi possível atualizar agora.',
    };
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(mensagem)));
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
          TextButton(onPressed: () => Navigator.pop(contexto, false), child: const Text('Cancelar')),
          FilledButton(onPressed: () => Navigator.pop(contexto, true), child: const Text('Sair')),
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
          IconButton(onPressed: _sair, icon: const Icon(Icons.logout), tooltip: 'Sair'),
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
                      Expanded(child: Text('Sem internet no momento. Usando os dados salvos no aparelho.')),
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
                label: Text(_atualizando ? 'Atualizando...' : 'Atualizar agora'),
              ),
              const Spacer(),
              // A tela de registro de ponto propriamente dita (hora do
              // servidor, botões de entrada/saída, captura de posição e
              // selfie) é a próxima tarefa do fluxo — aqui fica o ponto de
              // entrada já autenticado e com dados sincronizados.
              const Center(child: Text('Tela de registro de ponto')),
              const Spacer(),
            ],
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';

import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../services/connectivity_service.dart';
import '../services/sync_service.dart';
import 'admin_screen.dart';
import 'home_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _auth = AuthService();
  final _sync = SyncService();
  final _conectividade = ConnectivityService();

  final _emailController = TextEditingController();
  final _senhaController = TextEditingController();

  bool _carregando = false;
  bool _semInternet = false;
  String? _erro;

  @override
  void initState() {
    super.initState();
    _verificarConectividade();
  }

  Future<void> _verificarConectividade() async {
    final tem = await _conectividade.temInternet();
    if (mounted) setState(() => _semInternet = !tem);
  }

  Future<void> _entrar() async {
    setState(() {
      _carregando = true;
      _erro = null;
    });

    try {
      await _auth.login(
          email: _emailController.text.trim(), senha: _senhaController.text);
      // primeira sincronização, já com o login recém-feito
      await _sync.sincronizarSePossivel();
      final sessao = await _auth.usuarioLogado();
      if (!mounted) return;
      final perfil = sessao?['usuario_perfil'] as String?;
      final Widget destino =
          const {'superadmin', 'rh', 'gestor'}.contains(perfil)
              ? const AdminScreen()
              : const HomeScreen();
      Navigator.of(context)
          .pushReplacement(MaterialPageRoute(builder: (_) => destino));
    } on ApiException catch (e) {
      setState(() => _erro = e.mensagem);
    } catch (_) {
      setState(() => _erro =
          'Não foi possível entrar. Confira seus dados e tente de novo.');
    } finally {
      if (mounted) setState(() => _carregando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Icon(Icons.access_time_filled, size: 56),
              const SizedBox(height: 8),
              const Text('Ponto Aqui',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
              const SizedBox(height: 32),
              if (_semInternet)
                Container(
                  padding: const EdgeInsets.all(12),
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: Colors.orange.shade50,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.orange.shade200),
                  ),
                  child: const Text(
                    'Sem internet no momento. O primeiro login precisa de rede.',
                    style: TextStyle(color: Colors.orange),
                  ),
                ),
              TextField(
                controller: _emailController,
                decoration: const InputDecoration(
                    labelText: 'E-mail', border: OutlineInputBorder()),
                keyboardType: TextInputType.emailAddress,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _senhaController,
                decoration: const InputDecoration(
                    labelText: 'Senha', border: OutlineInputBorder()),
                obscureText: true,
              ),
              if (_erro != null) ...[
                const SizedBox(height: 12),
                Text(_erro!, style: const TextStyle(color: Colors.red)),
              ],
              const SizedBox(height: 20),
              FilledButton(
                onPressed: _carregando ? null : _entrar,
                child: _carregando
                    ? const SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('Entrar'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

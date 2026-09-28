import 'package:flutter/material.dart';

import '../services/auth_service.dart';
import '../services/sync_service.dart';
import 'home_screen.dart';
import 'login_screen.dart';

/// Tarefa A01 — tela de abertura: havendo internet, atualiza o que fica
/// guardado no aparelho; sem internet, segue direto com o que já estava lá.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  final _auth = AuthService();
  final _sync = SyncService();

  @override
  void initState() {
    super.initState();
    _iniciar();
  }

  Future<void> _iniciar() async {
    final logado = await _auth.sessaoAtiva();

    if (logado) {
      // Sincroniza em segundo plano — se não houver rede, a chamada
      // simplesmente não altera nada e o app segue com o que já tinha.
      await _sync.sincronizarSePossivel();
    }

    if (!mounted) return;

    final aindaLogado = await _auth.sessaoAtiva();
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => aindaLogado ? const HomeScreen() : const LoginScreen(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.access_time_filled, size: 64),
            SizedBox(height: 16),
            Text('Ponto Aqui'),
            SizedBox(height: 24),
            CircularProgressIndicator(),
          ],
        ),
      ),
    );
  }
}

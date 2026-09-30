import 'package:flutter/material.dart';

import 'screens/splash_screen.dart';

void main() {
  runApp(const PontoAquiApp());
}

class PontoAquiApp extends StatelessWidget {
  const PontoAquiApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Ponto Aqui',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
          colorSchemeSeed: const Color(0xFF1F3A5F), useMaterial3: true),
      home: const SplashScreen(),
    );
  }
}

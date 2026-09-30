import 'dart:math';

import 'package:geolocator/geolocator.dart';

class Localizacao {
  const Localizacao({required this.latitude, required this.longitude});

  final double latitude;
  final double longitude;
}

class LocationService {
  Future<Localizacao?> capturar() async {
    if (!await Geolocator.isLocationServiceEnabled()) return null;
    var permissao = await Geolocator.checkPermission();
    if (permissao == LocationPermission.denied) {
      permissao = await Geolocator.requestPermission();
    }
    if (permissao == LocationPermission.denied ||
        permissao == LocationPermission.deniedForever) {
      return null;
    }

    try {
      final posicao = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 10),
        ),
      );
      return Localizacao(
          latitude: posicao.latitude, longitude: posicao.longitude);
    } on Exception {
      return null;
    }
  }

  static double distanciaMetros({
    required double latitudeA,
    required double longitudeA,
    required double latitudeB,
    required double longitudeB,
  }) {
    const raioTerra = 6371000.0;
    double radianos(double graus) => graus * pi / 180;
    final deltaLatitude = radianos(latitudeB - latitudeA);
    final deltaLongitude = radianos(longitudeB - longitudeA);
    final latitudeInicial = radianos(latitudeA);
    final latitudeFinal = radianos(latitudeB);
    final a = pow(sin(deltaLatitude / 2), 2) +
        cos(latitudeInicial) *
            cos(latitudeFinal) *
            pow(sin(deltaLongitude / 2), 2);
    return 2 * raioTerra * asin(sqrt(a.toDouble()));
  }
}

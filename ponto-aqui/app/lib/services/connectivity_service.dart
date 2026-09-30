import 'package:connectivity_plus/connectivity_plus.dart';

class ConnectivityService {
  Future<bool> temInternet() async {
    final resultado = await Connectivity().checkConnectivity();
    return !resultado.contains(ConnectivityResult.none);
  }
}

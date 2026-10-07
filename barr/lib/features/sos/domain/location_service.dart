import 'sos_event.dart';

abstract interface class LocationService {
  /// Best-effort current position; `null` if denied/unavailable/timeout.
  Future<GeoFix?> current({Duration timeout = const Duration(seconds: 8)});

  Future<bool> hasPermission();
  Future<bool> requestPermission();
}

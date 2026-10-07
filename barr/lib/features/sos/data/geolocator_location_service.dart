import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';

import '../domain/location_service.dart';
import '../domain/sos_event.dart';

class GeolocatorLocationService implements LocationService {
  @override
  Future<bool> hasPermission() async {
    try {
      final p = await Geolocator.checkPermission();
      return p == LocationPermission.always || p == LocationPermission.whileInUse;
    } catch (_) {
      return false;
    }
  }

  @override
  Future<bool> requestPermission() async {
    try {
      var p = await Geolocator.checkPermission();
      if (p == LocationPermission.denied) p = await Geolocator.requestPermission();
      return p == LocationPermission.always || p == LocationPermission.whileInUse;
    } catch (_) {
      return false;
    }
  }

  @override
  Future<GeoFix?> current({Duration timeout = const Duration(seconds: 8)}) async {
    try {
      if (!await hasPermission() && !await requestPermission()) return null;
      Position? pos;
      try {
        pos = await Geolocator.getCurrentPosition(
          locationSettings: LocationSettings(accuracy: LocationAccuracy.high, timeLimit: timeout),
        );
      } catch (_) {
        pos = await Geolocator.getLastKnownPosition();
      }
      if (pos == null) return null;
      return GeoFix(lat: pos.latitude, lng: pos.longitude, accuracy: pos.accuracy);
    } catch (e) {
      debugPrint('Location unavailable: $e');
      return null;
    }
  }
}

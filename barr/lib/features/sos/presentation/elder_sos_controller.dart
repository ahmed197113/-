import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../shared/domain/entities/elder.dart';
import '../../../shared/domain/entities/family.dart';
import '../../elder_home/data/elder_home_providers.dart';
import '../data/sos_providers.dart';

/// Parent presses SOS: share location with the family, then call the
/// first emergency contact (or the first child).
class ElderSosController {
  ElderSosController(this._ref);

  final Ref _ref;

  /// Returns the new event id, or null if the parent isn't linked.
  Future<String?> trigger() async {
    final elder = _ref.read(myElderRefProvider);
    if (elder == null) return null;
    final location = await _ref.read(locationServiceProvider).current(timeout: const Duration(seconds: 6));
    return _ref.read(sosRepositoryProvider).trigger(elder, location: location);
  }

  /// Who the phone calls on SOS.
  ({String name, String phone})? emergencyTarget() {
    final Elder? elder = _ref.read(myElderProvider).value;
    final contacts = elder?.emergencyContacts ?? const [];
    if (contacts.isNotEmpty) return (name: contacts.first.name, phone: contacts.first.phone);
    final Member? kid = _ref.read(myChildrenProvider).where((m) => m.phone != null).firstOrNull;
    return kid == null ? null : (name: kid.displayName, phone: kid.phone!);
  }

  Future<void> callEmergency() async {
    final target = emergencyTarget();
    if (target == null) return;
    try {
      await launchUrl(Uri(scheme: 'tel', path: target.phone));
    } catch (_) {
      // No dialer (tablet/emulator): the family alert has already gone out.
    }
  }

  Future<void> cancel(String eventId) async {
    final elder = _ref.read(myElderRefProvider);
    if (elder == null) return;
    final name = _ref.read(myElderProvider).value?.displayName ?? '';
    await _ref.read(sosRepositoryProvider).resolve(elder, eventId, byName: name);
  }
}

final elderSosControllerProvider = Provider<ElderSosController>(ElderSosController.new);

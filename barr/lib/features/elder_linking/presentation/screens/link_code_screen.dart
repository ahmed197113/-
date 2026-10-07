import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../../../core/l10n/generated/app_localizations.dart';
import '../../../../core/error/failure_message.dart';
import '../../../../core/utils/link_code.dart';
import '../../../../core/widgets/feedback.dart';
import '../../../../core/widgets/skeleton.dart';
import '../../../../shared/domain/entities/elder.dart';
import '../../../family/data/family_providers.dart';
import '../../data/linking_providers.dart';

/// Caregiver side: shows a one-time code + QR for the parent's device,
/// and offers Setup Mode (turn this phone into the parent's phone).
class LinkCodeScreen extends ConsumerStatefulWidget {
  const LinkCodeScreen({super.key, required this.elderId});

  final String elderId;

  @override
  ConsumerState<LinkCodeScreen> createState() => _LinkCodeScreenState();
}

class _LinkCodeScreenState extends ConsumerState<LinkCodeScreen> {
  LinkCode? _code;
  Object? _error;
  Timer? _ticker;
  bool _settingUp = false;

  @override
  void initState() {
    super.initState();
    _generate();
    _ticker = Timer.periodic(const Duration(seconds: 15), (_) => setState(() {}));
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  Future<void> _generate() async {
    final fid = ref.read(currentFamilyIdProvider);
    if (fid == null) return;
    setState(() {
      _code = null;
      _error = null;
    });
    try {
      final code = await ref.read(linkingRepositoryProvider).createLinkCode(fid, widget.elderId);
      if (mounted) setState(() => _code = code);
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  Future<void> _setupThisDevice(String elderName) async {
    final l = AppLocalizations.of(context);
    final code = _code;
    if (code == null) return;
    final ok = await confirmDialog(
      context,
      title: l.setupThisDevice,
      message: l.setupThisDeviceConfirm(elderName),
      confirmLabel: l.confirm,
      cancelLabel: l.cancel,
    );
    if (!ok || !mounted) return;
    setState(() => _settingUp = true);
    // Capture the repository before the session switches: redeeming signs
    // this device into the parent's account and the router navigates away.
    final linking = ref.read(linkingRepositoryProvider);
    final success = await runWithFeedback(context, () => linking.redeem(code.code));
    if (!success && mounted) setState(() => _settingUp = false);
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final fid = ref.watch(currentFamilyIdProvider);
    final elders = fid == null ? const <Elder>[] : ref.watch(eldersProvider(fid)).value ?? const [];
    final elder = elders.where((e) => e.id == widget.elderId).firstOrNull;
    final name = elder?.displayName ?? '';
    final code = _code;
    final expired = code?.isExpired(DateTime.now()) ?? false;
    final minutesLeft = code == null
        ? 0
        : (code.expiresAt.difference(DateTime.now()).inSeconds / 60).ceil().clamp(0, 99);

    return Scaffold(
      appBar: AppBar(title: Text(l.linkTitle(name))),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            Text(l.linkInstructions, style: theme.textTheme.bodyLarge, textAlign: TextAlign.center),
            const SizedBox(height: 24),
            if (_error != null)
              Column(
                children: [
                  Text(failureMessage(context, _error), textAlign: TextAlign.center),
                  const SizedBox(height: 12),
                  OutlinedButton(onPressed: _generate, child: Text(l.retry)),
                ],
              )
            else if (code == null)
              const Center(child: SizedBox(width: 240, child: Skeleton(height: 320)))
            else ...[
              Center(
                child: Opacity(
                  opacity: expired ? 0.25 : 1,
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(24),
                    ),
                    child: QrImageView(
                      data: LinkCodeUtils.qrPayload(code.code),
                      size: 220,
                      semanticsLabel: code.code,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 20),
              Directionality(
                textDirection: TextDirection.ltr,
                child: SelectableText(
                  '${code.code.substring(0, 3)} ${code.code.substring(3)}',
                  textAlign: TextAlign.center,
                  style: theme.textTheme.displaySmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    letterSpacing: 6,
                    decoration: expired ? TextDecoration.lineThrough : null,
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                expired ? l.linkExpired : l.linkExpiresIn(minutesLeft),
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: expired ? theme.colorScheme.error : theme.colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: _generate,
                icon: const Icon(Icons.refresh_rounded),
                label: Text(l.newCode),
              ),
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: expired || _settingUp ? null : () => _setupThisDevice(name),
                icon: _settingUp
                    ? const SizedBox(
                        width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.phonelink_setup_rounded),
                label: Text(l.setupThisDevice),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

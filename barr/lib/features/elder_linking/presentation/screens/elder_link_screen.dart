import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/l10n/generated/app_localizations.dart';
import '../../../../core/router/app_stage.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/link_code.dart';
import '../../../../core/widgets/feedback.dart';
import '../../data/linking_providers.dart';

/// Parent side: enter or scan the 6-digit code. Uses the large elder theme.
class ElderLinkScreen extends ConsumerStatefulWidget {
  const ElderLinkScreen({super.key});

  @override
  ConsumerState<ElderLinkScreen> createState() => _ElderLinkScreenState();
}

class _ElderLinkScreenState extends ConsumerState<ElderLinkScreen> {
  final _code = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _redeem([String? raw]) async {
    final l = AppLocalizations.of(context);
    final code = LinkCodeUtils.parse(raw ?? _code.text);
    if (code == null) {
      showSnack(context, l.errorInvalidLinkCode, error: true);
      return;
    }
    setState(() => _busy = true);
    final linking = ref.read(linkingRepositoryProvider);
    final ok = await runWithFeedback(context, () => linking.redeem(code));
    // On success the router switches to the elder home.
    if (!ok && mounted) setState(() => _busy = false);
  }

  Future<void> _scan() async {
    final result = await context.push<String>(Routes.elderScan);
    if (result != null && mounted) {
      _code.text = LinkCodeUtils.parse(result) ?? '';
      await _redeem(result);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return Theme(
      data: AppTheme.elder(),
      child: Builder(builder: (context) {
        final theme = Theme.of(context);
        return Scaffold(
          appBar: AppBar(
            toolbarHeight: 72,
            leading: Navigator.of(context).canPop() ? const BackButton() : null,
          ),
          body: SafeArea(
            child: ListView(
              padding: const EdgeInsets.all(24),
              children: [
                Text(l.elderLinkTitle,
                    textAlign: TextAlign.center, style: theme.textTheme.headlineMedium),
                const SizedBox(height: 12),
                Text(l.elderLinkSubtitle,
                    textAlign: TextAlign.center, style: theme.textTheme.bodyLarge),
                const SizedBox(height: 32),
                Directionality(
                  textDirection: TextDirection.ltr,
                  child: TextField(
                    controller: _code,
                    keyboardType: TextInputType.number,
                    textAlign: TextAlign.center,
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r'[0-9٠-٩۰-۹]')),
                      LengthLimitingTextInputFormatter(6),
                    ],
                    style: const TextStyle(fontSize: 44, fontWeight: FontWeight.w800, letterSpacing: 14),
                    decoration: InputDecoration(
                      hintText: '••••••',
                      filled: true,
                      fillColor: Colors.white,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                        borderSide: const BorderSide(width: 3),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: _busy ? null : _redeem,
                  child: _busy
                      ? const SizedBox(
                          width: 36, height: 36, child: CircularProgressIndicator(strokeWidth: 3))
                      : Text(l.linkNow),
                ),
                const SizedBox(height: 16),
                FilledButton.tonalIcon(
                  style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(88)),
                  onPressed: _busy ? null : _scan,
                  icon: const Icon(Icons.qr_code_scanner_rounded, size: 36),
                  label: Text(l.scanCode, style: theme.textTheme.titleLarge),
                ),
              ],
            ),
          ),
        );
      }),
    );
  }
}

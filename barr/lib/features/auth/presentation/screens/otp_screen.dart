import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/config/app_config.dart';
import '../../../../core/l10n/generated/app_localizations.dart';
import '../../../../core/utils/phone.dart';
import '../../../../core/widgets/busy_button.dart';
import '../../../../core/widgets/feedback.dart';
import '../controllers/phone_auth_controller.dart';

class OtpScreen extends ConsumerStatefulWidget {
  const OtpScreen({super.key});

  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  static const _resendSeconds = 60;

  final _code = TextEditingController();
  bool _busy = false;
  int _secondsLeft = _resendSeconds;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  void _startTimer() {
    _timer?.cancel();
    setState(() => _secondsLeft = _resendSeconds);
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (_secondsLeft <= 1) t.cancel();
      setState(() => _secondsLeft--);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _code.dispose();
    super.dispose();
  }

  Future<void> _verify() async {
    final l = AppLocalizations.of(context);
    final code = PhoneUtils.toAsciiDigits(_code.text.trim());
    if (code.length != 6) {
      showSnack(context, l.otpInvalidLength, error: true);
      return;
    }
    setState(() => _busy = true);
    await runWithFeedback(context, () => ref.read(phoneAuthControllerProvider.notifier).confirm(code));
    // On success the router redirects away from this screen.
    if (mounted) setState(() => _busy = false);
  }

  Future<void> _resend() async {
    final phone = ref.read(phoneAuthControllerProvider)?.phone;
    if (phone == null) return;
    final ok = await runWithFeedback(
      context,
      () => ref.read(phoneAuthControllerProvider.notifier).sendOtp(phone, resend: true),
    );
    if (ok && mounted) _startTimer();
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final phone = ref.watch(phoneAuthControllerProvider)?.phone ?? '';
    final isDemo = ref.watch(appConfigProvider).isDemo;

    return Scaffold(
      appBar: AppBar(),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            Text(l.otpTitle,
                style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            Text(l.otpSentTo(PhoneUtils.display(phone)), style: theme.textTheme.bodyLarge),
            if (isDemo) ...[
              const SizedBox(height: 12),
              Text(l.demoOtpHint,
                  style: TextStyle(color: theme.colorScheme.tertiary, fontWeight: FontWeight.w700)),
            ],
            const SizedBox(height: 32),
            Directionality(
              textDirection: TextDirection.ltr,
              child: TextField(
                controller: _code,
                autofocus: true,
                keyboardType: TextInputType.number,
                textAlign: TextAlign.center,
                autofillHints: const [AutofillHints.oneTimeCode],
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'[0-9٠-٩۰-۹]')),
                  LengthLimitingTextInputFormatter(6),
                ],
                style: const TextStyle(fontSize: 32, letterSpacing: 12, fontWeight: FontWeight.w700),
                decoration: const InputDecoration(hintText: '••••••'),
                onChanged: (v) {
                  if (v.length == 6) _verify();
                },
              ),
            ),
            const SizedBox(height: 32),
            BusyButton(label: l.verify, busy: _busy, onPressed: _verify),
            const SizedBox(height: 12),
            TextButton(
              onPressed: _secondsLeft > 0 ? null : _resend,
              child: Text(_secondsLeft > 0 ? l.resendIn(_secondsLeft) : l.resendCode),
            ),
          ],
        ),
      ),
    );
  }
}

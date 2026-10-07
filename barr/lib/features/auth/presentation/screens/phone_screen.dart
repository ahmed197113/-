import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/l10n/generated/app_localizations.dart';
import '../../../../core/router/app_stage.dart';
import '../../../../core/utils/phone.dart';
import '../../../../core/widgets/busy_button.dart';
import '../../../../core/widgets/feedback.dart';
import '../controllers/phone_auth_controller.dart';

class PhoneScreen extends ConsumerStatefulWidget {
  const PhoneScreen({super.key});

  @override
  ConsumerState<PhoneScreen> createState() => _PhoneScreenState();
}

class _PhoneScreenState extends ConsumerState<PhoneScreen> {
  final _formKey = GlobalKey<FormState>();
  final _phone = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _phone.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final e164 = PhoneUtils.normalize(_phone.text)!;
    setState(() => _busy = true);
    var autoVerified = false;
    final ok = await runWithFeedback(context, () async {
      final v = await ref.read(phoneAuthControllerProvider.notifier).sendOtp(e164);
      autoVerified = v.autoVerified;
    });
    if (!mounted) return;
    setState(() => _busy = false);
    // When auto-verified the router moves on by itself.
    if (ok && !autoVerified) context.push(Routes.otp);
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              Text(l.phoneTitle,
                  style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
              const SizedBox(height: 8),
              Text(l.phoneSubtitle, style: theme.textTheme.bodyLarge),
              const SizedBox(height: 32),
              Directionality(
                textDirection: TextDirection.ltr,
                child: TextFormField(
                  controller: _phone,
                  autofocus: true,
                  keyboardType: TextInputType.phone,
                  textInputAction: TextInputAction.done,
                  autofillHints: const [AutofillHints.telephoneNumber],
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'[0-9٠-٩۰-۹+ ]')),
                    LengthLimitingTextInputFormatter(16),
                  ],
                  style: const TextStyle(fontSize: 22, letterSpacing: 1.5),
                  decoration: InputDecoration(
                    hintText: l.phoneHint,
                    prefixIcon: const Icon(Icons.phone_rounded),
                  ),
                  validator: (v) => PhoneUtils.normalize(v ?? '') == null ? l.phoneInvalid : null,
                  onFieldSubmitted: (_) => _submit(),
                ),
              ),
              const SizedBox(height: 32),
              BusyButton(label: l.sendCode, busy: _busy, onPressed: _submit),
            ],
          ),
        ),
      ),
    );
  }
}

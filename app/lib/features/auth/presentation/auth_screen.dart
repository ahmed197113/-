import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/art/occasion_art.dart';
import '../../../core/l10n/tr.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/common.dart';
import '../data/auth_repository.dart';

class AuthScreen extends ConsumerStatefulWidget {
  const AuthScreen({super.key});

  @override
  ConsumerState<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends ConsumerState<AuthScreen> {
  bool _busy = false;

  Future<void> _do(Future<String?> Function(AuthRepository) action) async {
    setState(() => _busy = true);
    final error = await action(ref.read(authRepositoryProvider));
    if (!mounted) return;
    setState(() => _busy = false);
    if (error == null) {
      context.go('/home');
    } else {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error)));
    }
  }

  Future<void> _phone() async {
    final phone = TextEditingController(text: '+');
    final code = TextEditingController();
    String? verificationId;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) => Padding(
          padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(ctx.tr('الدخول برقم الهاتف', 'Sign in with phone'),
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            const SizedBox(height: 16),
            if (verificationId == null)
              TextField(
                controller: phone,
                keyboardType: TextInputType.phone,
                textDirection: TextDirection.ltr,
                decoration: InputDecoration(hintText: '+9665XXXXXXXX', labelText: ctx.tr('رقم الهاتف مع رمز الدولة', 'Phone with country code')),
              )
            else
              TextField(
                controller: code,
                keyboardType: TextInputType.number,
                textDirection: TextDirection.ltr,
                maxLength: 6,
                decoration: InputDecoration(labelText: ctx.tr('رمز التحقق', 'Verification code')),
              ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: () async {
                final repo = ref.read(authRepositoryProvider);
                if (verificationId == null) {
                  final err = await repo.sendPhoneCode(phone.text.trim(), (id) => setSheet(() => verificationId = id));
                  if (err != null && ctx.mounted) {
                    ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text(err)));
                  }
                } else {
                  final err = await repo.verifyPhoneCode(verificationId!, code.text.trim());
                  if (!ctx.mounted) return;
                  if (err == null) {
                    Navigator.pop(ctx);
                    if (mounted) context.go('/home');
                  } else {
                    ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text(err)));
                  }
                }
              },
              child: Text(verificationId == null ? ctx.tr('أرسل الرمز', 'Send code') : ctx.tr('تأكيد', 'Verify')),
            ),
          ]),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(fit: StackFit.expand, children: [
        const CustomPaint(painter: OccasionArtPainter(motif: 'crescent', colors: [AppColors.night, AppColors.gold, Color(0xFF2B3F66)], seed: 3)),
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Spacer(),
                const GoldText('مناسبة', style: TextStyle(fontFamily: 'ArefRuqaa', fontSize: 72, height: 1.4)),
                const SizedBox(height: 20),
                Text(context.tr('استوديو صور المناسبات بالذكاء الاصطناعي', 'AI photo studio for Arab occasions'),
                    textAlign: TextAlign.center, style: const TextStyle(color: Colors.white70, fontSize: 16)),
                const Spacer(),
                FilledButton.icon(
                  onPressed: _busy ? null : () => _do((r) => r.continueAsGuest()),
                  icon: const Icon(Icons.auto_awesome),
                  label: Text(context.tr('جرّب مجاناً الآن', 'Try free now')),
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: _busy ? null : () => _do((r) => r.signInWithGoogle()),
                  icon: const Icon(Icons.g_mobiledata, size: 30),
                  label: Text(context.tr('المتابعة بحساب Google', 'Continue with Google')),
                  style: OutlinedButton.styleFrom(foregroundColor: Colors.white),
                ),
                if (Platform.isIOS) ...[
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: _busy ? null : () => _do((r) => r.signInWithApple()),
                    icon: const Icon(Icons.apple),
                    label: Text(context.tr('المتابعة بحساب Apple', 'Continue with Apple')),
                    style: OutlinedButton.styleFrom(foregroundColor: Colors.white),
                  ),
                ],
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: _busy ? null : _phone,
                  icon: const Icon(Icons.phone_iphone),
                  label: Text(context.tr('الدخول برقم الهاتف', 'Continue with phone')),
                  style: OutlinedButton.styleFrom(foregroundColor: Colors.white),
                ),
                const SizedBox(height: 16),
                TextButton(
                  onPressed: () => context.push('/privacy'),
                  child: Text(
                    context.tr('بالمتابعة أنت توافق على الشروط وسياسة الخصوصية', 'By continuing you accept the Terms & Privacy Policy'),
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.white60, fontSize: 12, decoration: TextDecoration.underline),
                  ),
                ),
              ],
            ),
          ),
        ),
      ]),
    );
  }
}

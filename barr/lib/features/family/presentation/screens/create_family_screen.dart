import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/l10n/generated/app_localizations.dart';
import '../../../../core/widgets/busy_button.dart';
import '../../../../core/widgets/feedback.dart';
import '../../data/family_providers.dart';

class CreateFamilyScreen extends ConsumerStatefulWidget {
  const CreateFamilyScreen({super.key});

  @override
  ConsumerState<CreateFamilyScreen> createState() => _CreateFamilyScreenState();
}

class _CreateFamilyScreenState extends ConsumerState<CreateFamilyScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _busy = true);
    await runWithFeedback(
      context,
      () => ref.read(familyRepositoryProvider).createFamily(_name.text.trim()),
    );
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Scaffold(
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              const SizedBox(height: 32),
              Icon(Icons.home_rounded, size: 72, color: theme.colorScheme.primary),
              const SizedBox(height: 16),
              Text(l.createFamilyTitle,
                  textAlign: TextAlign.center,
                  style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
              const SizedBox(height: 8),
              Text(l.createFamilySubtitle,
                  textAlign: TextAlign.center, style: theme.textTheme.bodyLarge),
              const SizedBox(height: 32),
              TextFormField(
                controller: _name,
                decoration: InputDecoration(labelText: l.familyNameLabel, hintText: l.familyNameHint),
                validator: (v) => (v ?? '').trim().length < 2 ? l.nameRequired : null,
                onFieldSubmitted: (_) => _submit(),
              ),
              const SizedBox(height: 32),
              BusyButton(label: l.createFamily, busy: _busy, onPressed: _submit),
            ],
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/l10n/generated/app_localizations.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/busy_button.dart';
import '../../../../core/widgets/feedback.dart';
import '../../../../shared/domain/entities/enums.dart';
import '../../data/auth_providers.dart';

class AccountTypeScreen extends ConsumerStatefulWidget {
  const AccountTypeScreen({super.key});

  @override
  ConsumerState<AccountTypeScreen> createState() => _AccountTypeScreenState();
}

class _AccountTypeScreenState extends ConsumerState<AccountTypeScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  AccountType _type = AccountType.caregiver;
  bool _busy = false;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final auth = ref.read(authRepositoryProvider);
    final uid = auth.currentUid;
    if (uid == null) return;
    setState(() => _busy = true);
    await runWithFeedback(
      context,
      () => ref.read(profileRepositoryProvider).create(
            uid: uid,
            displayName: _name.text.trim(),
            accountType: _type,
            phone: auth.currentPhone,
          ),
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
              const SizedBox(height: 24),
              Text(l.accountTypeTitle,
                  style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
              const SizedBox(height: 8),
              Text(l.accountTypeSubtitle, style: theme.textTheme.bodyLarge),
              const SizedBox(height: 24),
              _TypeCard(
                icon: Icons.volunteer_activism_rounded,
                color: BarrColors.teal,
                title: l.accountTypeCaregiver,
                subtitle: l.accountTypeCaregiverDesc,
                selected: _type == AccountType.caregiver,
                onTap: () => setState(() => _type = AccountType.caregiver),
              ),
              const SizedBox(height: 12),
              _TypeCard(
                icon: Icons.elderly_rounded,
                color: BarrColors.warm,
                title: l.accountTypeElder,
                subtitle: l.accountTypeElderDesc,
                selected: _type == AccountType.elder,
                onTap: () => setState(() => _type = AccountType.elder),
              ),
              const SizedBox(height: 24),
              TextFormField(
                controller: _name,
                textInputAction: TextInputAction.done,
                textCapitalization: TextCapitalization.words,
                decoration: InputDecoration(labelText: l.yourName),
                validator: (v) => (v ?? '').trim().length < 2 ? l.nameRequired : null,
              ),
              const SizedBox(height: 32),
              BusyButton(label: l.continueLabel, busy: _busy, onPressed: _submit),
            ],
          ),
        ),
      ),
    );
  }
}

class _TypeCard extends StatelessWidget {
  const _TypeCard({
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Semantics(
      selected: selected,
      button: true,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        decoration: BoxDecoration(
          color: Theme.of(context).cardTheme.color,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: selected ? color : scheme.outlineVariant, width: selected ? 2.5 : 1),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: color.withValues(alpha: 0.15),
                  child: Icon(icon, color: color, size: 30),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title,
                          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                      const SizedBox(height: 4),
                      Text(subtitle, style: TextStyle(color: scheme.onSurfaceVariant)),
                    ],
                  ),
                ),
                Icon(selected ? Icons.check_circle_rounded : Icons.circle_outlined,
                    color: selected ? color : scheme.outline),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

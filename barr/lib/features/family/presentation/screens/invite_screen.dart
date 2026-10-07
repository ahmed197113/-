import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/l10n/generated/app_localizations.dart';
import '../../../../core/utils/phone.dart';
import '../../../../core/widgets/busy_button.dart';
import '../../../../core/widgets/feedback.dart';
import '../../../../shared/domain/entities/enums.dart';
import '../../data/family_providers.dart';
import '../l10n_labels.dart';

class InviteScreen extends ConsumerStatefulWidget {
  const InviteScreen({super.key});

  @override
  ConsumerState<InviteScreen> createState() => _InviteScreenState();
}

class _InviteScreenState extends ConsumerState<InviteScreen> {
  final _formKey = GlobalKey<FormState>();
  final _phone = TextEditingController();
  FamilyRole _role = FamilyRole.caregiver;
  bool _busy = false;

  @override
  void dispose() {
    _phone.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final fid = ref.read(currentFamilyIdProvider);
    if (fid == null) return;
    final l = AppLocalizations.of(context);
    setState(() => _busy = true);
    final ok = await runWithFeedback(
      context,
      () => ref
          .read(familyRepositoryProvider)
          .invite(fid, phone: PhoneUtils.normalize(_phone.text)!, role: _role),
    );
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) {
      showSnack(context, l.inviteSent);
      context.pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l.inviteTitle)),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              Text(l.inviteBody, style: Theme.of(context).textTheme.bodyLarge),
              const SizedBox(height: 24),
              Directionality(
                textDirection: TextDirection.ltr,
                child: TextFormField(
                  controller: _phone,
                  keyboardType: TextInputType.phone,
                  decoration: InputDecoration(labelText: l.memberPhone, hintText: l.phoneHint),
                  validator: (v) => PhoneUtils.normalize(v ?? '') == null ? l.phoneInvalid : null,
                ),
              ),
              const SizedBox(height: 24),
              Text(l.role, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              SegmentedButton<FamilyRole>(
                segments: [
                  for (final r in const [FamilyRole.caregiver, FamilyRole.viewer, FamilyRole.admin])
                    ButtonSegment(value: r, label: Text(r.label(l))),
                ],
                selected: {_role},
                onSelectionChanged: (s) => setState(() => _role = s.first),
              ),
              const SizedBox(height: 32),
              BusyButton(label: l.sendInvite, busy: _busy, onPressed: _submit),
            ],
          ),
        ),
      ),
    );
  }
}

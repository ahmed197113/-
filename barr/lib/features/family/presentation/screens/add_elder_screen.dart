import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/l10n/generated/app_localizations.dart';
import '../../../../core/router/app_stage.dart';
import '../../../../core/utils/phone.dart';
import '../../../../core/widgets/busy_button.dart';
import '../../../../core/widgets/feedback.dart';
import '../../../../shared/domain/entities/elder.dart';
import '../../../../shared/domain/entities/enums.dart';
import '../../data/family_providers.dart';
import '../l10n_labels.dart';

class AddElderScreen extends ConsumerStatefulWidget {
  const AddElderScreen({super.key});

  @override
  ConsumerState<AddElderScreen> createState() => _AddElderScreenState();
}

class _AddElderScreenState extends ConsumerState<AddElderScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _nickname = TextEditingController();
  final _phone = TextEditingController();
  ElderRelation _relation = ElderRelation.father;
  bool _busy = false;

  @override
  void dispose() {
    _name.dispose();
    _nickname.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final fid = ref.read(currentFamilyIdProvider);
    if (fid == null) return;
    setState(() => _busy = true);
    Elder? created;
    await runWithFeedback(context, () async {
      created = await ref.read(familyRepositoryProvider).addElder(
            fid,
            ElderDraft(
              name: _name.text.trim(),
              nickname: _nickname.text.trim(),
              relation: _relation,
              phone: PhoneUtils.normalize(_phone.text),
            ),
          );
    });
    if (!mounted) return;
    setState(() => _busy = false);
    if (created != null) context.pushReplacement(Routes.linkElder(created!.id));
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l.addParentTitle)),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              Text(l.relation, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final r in ElderRelation.values)
                    ChoiceChip(
                      label: Text(r.label(l)),
                      selected: _relation == r,
                      onSelected: (_) => setState(() => _relation = r),
                    ),
                ],
              ),
              const SizedBox(height: 20),
              TextFormField(
                controller: _name,
                decoration: InputDecoration(labelText: l.parentName),
                validator: (v) => (v ?? '').trim().length < 2 ? l.nameRequired : null,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _nickname,
                decoration: InputDecoration(labelText: l.parentNickname, hintText: l.parentNicknameHint),
              ),
              const SizedBox(height: 16),
              Directionality(
                textDirection: TextDirection.ltr,
                child: TextFormField(
                  controller: _phone,
                  keyboardType: TextInputType.phone,
                  decoration: InputDecoration(
                    labelText: '${l.parentPhone} (${l.optional})',
                    hintText: l.phoneHint,
                  ),
                  validator: (v) => (v ?? '').trim().isEmpty || PhoneUtils.normalize(v!) != null
                      ? null
                      : l.phoneInvalid,
                ),
              ),
              const SizedBox(height: 32),
              BusyButton(label: l.save, busy: _busy, onPressed: _submit),
            ],
          ),
        ),
      ),
    );
  }
}

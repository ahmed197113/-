import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/l10n/generated/app_localizations.dart';
import '../../../../core/utils/phone.dart';
import '../../../../core/widgets/busy_button.dart';
import '../../../../core/widgets/feedback.dart';
import '../../../../shared/domain/entities/elder.dart';
import '../../data/family_providers.dart';

/// Caregiver-controlled settings for one parent (locked on their phone).
class ElderSettingsScreen extends ConsumerStatefulWidget {
  const ElderSettingsScreen({super.key, required this.elderId});

  final String elderId;

  @override
  ConsumerState<ElderSettingsScreen> createState() => _ElderSettingsScreenState();
}

class _ElderSettingsScreenState extends ConsumerState<ElderSettingsScreen> {
  ({int hour, int minute}) _deadline = (hour: 10, minute: 0);
  int? _inactivityHours;
  List<EmergencyContact> _contacts = [];
  bool _loaded = false;
  bool _busy = false;

  static const _inactivityOptions = [6, 12, 24, 48];

  Future<void> _pickDeadline() async {
    final t = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(hour: _deadline.hour, minute: _deadline.minute),
    );
    if (t != null) setState(() => _deadline = (hour: t.hour, minute: t.minute));
  }

  Future<void> _addContact() async {
    final l = AppLocalizations.of(context);
    final name = TextEditingController();
    final phone = TextEditingController();
    final key = GlobalKey<FormState>();
    final added = await showDialog<EmergencyContact>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l.addContact),
        content: Form(
          key: key,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                controller: name,
                decoration: InputDecoration(labelText: l.contactName),
                validator: (v) => (v ?? '').trim().isEmpty ? l.requiredField : null,
              ),
              const SizedBox(height: 12),
              Directionality(
                textDirection: TextDirection.ltr,
                child: TextFormField(
                  controller: phone,
                  keyboardType: TextInputType.phone,
                  decoration: InputDecoration(labelText: l.memberPhone, hintText: l.phoneHint),
                  validator: (v) => PhoneUtils.normalize(v ?? '') == null ? l.phoneInvalid : null,
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text(l.cancel)),
          FilledButton(
            style: FilledButton.styleFrom(minimumSize: const Size(88, 44)),
            onPressed: () {
              if (!key.currentState!.validate()) return;
              Navigator.pop(
                ctx,
                EmergencyContact(name: name.text.trim(), phone: PhoneUtils.normalize(phone.text)!),
              );
            },
            child: Text(l.save),
          ),
        ],
      ),
    );
    if (added != null) setState(() => _contacts = [..._contacts, added]);
  }

  Future<void> _save() async {
    final fid = ref.read(currentFamilyIdProvider);
    if (fid == null) return;
    final l = AppLocalizations.of(context);
    setState(() => _busy = true);
    final ok = await runWithFeedback(
      context,
      () => ref.read(familyRepositoryProvider).updateElderSettings(
            fid,
            widget.elderId,
            ElderSettings(
              checkinDeadline: _deadline,
              inactivityHours: _inactivityHours,
              emergencyContacts: _contacts,
            ),
          ),
    );
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) {
      showSnack(context, l.saved);
      context.pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final fid = ref.watch(currentFamilyIdProvider);
    final elder = fid == null
        ? null
        : (ref.watch(eldersProvider(fid)).value ?? const <Elder>[])
            .where((e) => e.id == widget.elderId)
            .firstOrNull;
    if (elder == null) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (!_loaded) {
      _loaded = true;
      _deadline = elder.checkinDeadline;
      _inactivityHours = elder.inactivityHours;
      _contacts = [...elder.emergencyContacts];
    }
    final deadlineText = MaterialLocalizations.of(context)
        .formatTimeOfDay(TimeOfDay(hour: _deadline.hour, minute: _deadline.minute));

    Widget section(String title, [String? help]) => Padding(
          padding: const EdgeInsets.fromLTRB(4, 20, 4, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
              if (help != null)
                Text(help, style: TextStyle(color: theme.colorScheme.onSurfaceVariant)),
            ],
          ),
        );

    return Scaffold(
      appBar: AppBar(title: Text(l.parentSettings(elder.displayName))),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
          children: [
            section(l.checkinDeadline, l.checkinDeadlineHelp),
            Card(
              child: ListTile(
                leading: const Icon(Icons.alarm_rounded),
                title: Text(deadlineText),
                trailing: const Icon(Icons.edit_rounded),
                onTap: _pickDeadline,
              ),
            ),
            section(l.inactivityAlert),
            Card(
              child: Column(
                children: [
                  SwitchListTile(
                    title: Text(l.inactivityAlert),
                    subtitle: Text(l.inactivityHelp),
                    value: _inactivityHours != null,
                    onChanged: (on) => setState(() => _inactivityHours = on ? 12 : null),
                  ),
                  if (_inactivityHours != null)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                      child: Wrap(
                        spacing: 8,
                        children: [
                          for (final h in _inactivityOptions)
                            ChoiceChip(
                              label: Text(l.hoursN(h)),
                              selected: _inactivityHours == h,
                              onSelected: (_) => setState(() => _inactivityHours = h),
                            ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
            section(l.emergencyContacts, l.emergencyContactsHelp),
            Card(
              child: Column(
                children: [
                  for (var i = 0; i < _contacts.length; i++)
                    ListTile(
                      leading: CircleAvatar(child: Text('${i + 1}')),
                      title: Text(_contacts[i].name),
                      subtitle: Text(PhoneUtils.display(_contacts[i].phone),
                          textDirection: TextDirection.ltr, textAlign: TextAlign.start),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (i > 0)
                            IconButton(
                              icon: const Icon(Icons.arrow_upward_rounded),
                              onPressed: () => setState(() {
                                final c = _contacts.removeAt(i);
                                _contacts.insert(i - 1, c);
                              }),
                            ),
                          IconButton(
                            icon: const Icon(Icons.delete_outline_rounded),
                            onPressed: () => setState(() => _contacts.removeAt(i)),
                          ),
                        ],
                      ),
                    ),
                  ListTile(
                    leading: const Icon(Icons.add_call),
                    title: Text(l.addContact),
                    onTap: _addContact,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            BusyButton(label: l.save, busy: _busy, onPressed: _save),
          ],
        ),
      ),
    );
  }
}

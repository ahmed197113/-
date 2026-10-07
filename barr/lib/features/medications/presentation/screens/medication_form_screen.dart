
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';

import '../../../../core/l10n/generated/app_localizations.dart';
import '../../../../core/utils/phone.dart';
import '../../../../core/widgets/busy_button.dart';
import '../../../../core/widgets/feedback.dart';
import '../../../../shared/domain/entities/app_user.dart';
import '../../../family/data/family_providers.dart';
import '../../data/medication_providers.dart';
import '../../domain/medication.dart';
import '../labels.dart';
import '../widgets/med_photo.dart';

/// Add / edit a medicine (caregivers only).
class MedicationFormScreen extends ConsumerStatefulWidget {
  const MedicationFormScreen({super.key, required this.elderId, this.medicationId});

  final String elderId;
  final String? medicationId;

  @override
  ConsumerState<MedicationFormScreen> createState() => _MedicationFormScreenState();
}

class _MedicationFormScreenState extends ConsumerState<MedicationFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _dose = TextEditingController();
  final _notes = TextEditingController();
  final _stock = TextEditingController();
  final _perDose = TextEditingController(text: '1');

  List<DoseTime> _times = [const DoseTime(8, 0)];
  Set<int> _weekdays = {};
  DateTime? _endDate;
  DateTime _startDate = DateTime.now();
  MealInstruction _meal = MealInstruction.none;
  String? _photoUrl;
  Uint8List? _newPhoto;
  Medication? _existing;
  bool _busy = false;
  bool _loaded = false;

  @override
  void dispose() {
    for (final c in [_name, _dose, _notes, _stock, _perDose]) {
      c.dispose();
    }
    super.dispose();
  }

  void _load(Medication m) {
    _existing = m;
    _name.text = m.name;
    _dose.text = m.dose;
    _notes.text = m.notes;
    _stock.text = m.stockQty?.toString() ?? '';
    _perDose.text = '${m.perDose}';
    _times = [...m.times];
    _weekdays = {...m.weekdays};
    _endDate = m.endDate;
    _startDate = m.startDate;
    _meal = m.meal;
    _photoUrl = m.photoUrl;
  }

  Future<void> _pickPhoto(ImageSource source) async {
    try {
      final file = await ImagePicker().pickImage(source: source, maxWidth: 1024, imageQuality: 80);
      if (file == null) return;
      final bytes = await file.readAsBytes();
      setState(() => _newPhoto = bytes);
    } catch (_) {
      if (mounted) showSnack(context, AppLocalizations.of(context).errorUnknown, error: true);
    }
  }

  void _preset(int count) {
    setState(() => _times = switch (count) {
          1 => [const DoseTime(8, 0)],
          2 => [const DoseTime(8, 0), const DoseTime(20, 0)],
          _ => [const DoseTime(8, 0), const DoseTime(14, 0), const DoseTime(20, 0)],
        });
  }

  Future<void> _editTime([int? index]) async {
    final initial = index == null ? const DoseTime(12, 0) : _times[index];
    final picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(hour: initial.hour, minute: initial.minute),
    );
    if (picked == null) return;
    final t = DoseTime(picked.hour, picked.minute);
    setState(() {
      if (index == null) {
        if (!_times.contains(t)) _times.add(t);
      } else {
        _times[index] = t;
      }
      _times = _times.toSet().toList()..sort();
    });
  }

  Future<void> _pickEndDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      firstDate: now,
      lastDate: now.add(const Duration(days: 365 * 3)),
      initialDate: _endDate ?? now.add(const Duration(days: 7)),
    );
    if (picked != null) setState(() => _endDate = picked);
  }

  Future<void> _save() async {
    final l = AppLocalizations.of(context);
    if (!_formKey.currentState!.validate()) return;
    if (_times.isEmpty) {
      showSnack(context, l.timesRequired, error: true);
      return;
    }
    final fid = ref.read(currentFamilyIdProvider);
    if (fid == null) return;
    final repo = ref.read(medicationRepositoryProvider);
    setState(() => _busy = true);
    final ok = await runWithFeedback(context, () async {
      var photo = _photoUrl;
      if (_newPhoto != null) photo = await repo.uploadPhoto(fid, widget.elderId, _newPhoto!);
      final stockText = PhoneUtils.toAsciiDigits(_stock.text.trim());
      await repo.save(
        fid,
        widget.elderId,
        Medication(
          id: _existing?.id ?? '',
          name: _name.text.trim(),
          dose: _dose.text.trim(),
          times: _times,
          weekdays: _weekdays,
          startDate: _startDate,
          endDate: _endDate,
          meal: _meal,
          notes: _notes.text.trim(),
          photoUrl: photo,
          stockQty: stockText.isEmpty ? null : int.parse(stockText),
          perDose: int.tryParse(PhoneUtils.toAsciiDigits(_perDose.text.trim())) ?? 1,
          buyer: _existing?.buyer,
        ),
      );
    });
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) context.pop();
  }

  Future<void> _delete() async {
    final l = AppLocalizations.of(context);
    final fid = ref.read(currentFamilyIdProvider);
    final m = _existing;
    if (fid == null || m == null) return;
    final confirmed = await confirmDialog(
      context,
      title: l.deleteMedication,
      message: l.deleteMedicationConfirm,
      confirmLabel: l.confirm,
      cancelLabel: l.cancel,
      destructive: true,
    );
    if (!confirmed || !mounted) return;
    final ok = await runWithFeedback(
        context, () => ref.read(medicationRepositoryProvider).delete(fid, widget.elderId, m.id));
    if (ok && mounted) context.pop();
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final fid = ref.watch(currentFamilyIdProvider);

    if (!_loaded && widget.medicationId != null && fid != null) {
      final meds = ref.watch(medicationsProvider(ElderRef(familyId: fid, elderId: widget.elderId))).value;
      final m = meds?.where((m) => m.id == widget.medicationId).firstOrNull;
      if (m == null) return const Scaffold(body: Center(child: CircularProgressIndicator()));
      _load(m);
      _loaded = true;
    }

    String? numberValidator(String? v, {bool required = false}) {
      final t = PhoneUtils.toAsciiDigits((v ?? '').trim());
      if (t.isEmpty) return required ? l.requiredField : null;
      return int.tryParse(t) == null || int.parse(t) < 0 ? l.invalidNumber : null;
    }

    Widget section(String title) => Padding(
          padding: const EdgeInsets.only(top: 24, bottom: 8),
          child: Text(title, style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
        );

    return Scaffold(
      appBar: AppBar(
        title: Text(_existing == null ? l.addMedication : l.editMedication),
        actions: [
          if (_existing != null)
            IconButton(
              tooltip: l.deleteMedication,
              icon: Icon(Icons.delete_outline_rounded, color: theme.colorScheme.error),
              onPressed: _delete,
            ),
        ],
      ),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
            children: [
              Center(
                child: Column(
                  children: [
                    _newPhoto != null
                        ? ClipRRect(
                            borderRadius: BorderRadius.circular(20),
                            child: Image.memory(_newPhoto!, width: 120, height: 120, fit: BoxFit.cover),
                          )
                        : MedPhoto(url: _photoUrl, size: 120, radius: 20),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        TextButton.icon(
                          onPressed: () => _pickPhoto(ImageSource.camera),
                          icon: const Icon(Icons.photo_camera_rounded),
                          label: Text(l.takePhoto),
                        ),
                        TextButton.icon(
                          onPressed: () => _pickPhoto(ImageSource.gallery),
                          icon: const Icon(Icons.photo_library_rounded),
                          label: Text(l.pickPhoto),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              TextFormField(
                controller: _name,
                decoration: InputDecoration(labelText: l.medName),
                validator: (v) => (v ?? '').trim().isEmpty ? l.requiredField : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _dose,
                decoration: InputDecoration(labelText: l.medDose, hintText: l.medDoseHint),
                validator: (v) => (v ?? '').trim().isEmpty ? l.requiredField : null,
              ),
              section(l.medTimes),
              Wrap(
                spacing: 8,
                children: [
                  ActionChip(label: Text(l.freqOnce), onPressed: () => _preset(1)),
                  ActionChip(label: Text(l.freqTwice), onPressed: () => _preset(2)),
                  ActionChip(label: Text(l.freqThrice), onPressed: () => _preset(3)),
                ],
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (var i = 0; i < _times.length; i++)
                    InputChip(
                      avatar: const Icon(Icons.alarm_rounded, size: 18),
                      label: Text(formatDoseTime(context, _times[i])),
                      onPressed: () => _editTime(i),
                      onDeleted: () => setState(() => _times.removeAt(i)),
                    ),
                  ActionChip(
                    avatar: const Icon(Icons.add_rounded, size: 18),
                    label: Text(l.addTime),
                    onPressed: _editTime,
                  ),
                ],
              ),
              section(l.medDays),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  ChoiceChip(
                    label: Text(l.everyDay),
                    selected: _weekdays.isEmpty,
                    onSelected: (_) => setState(() => _weekdays = {}),
                  ),
                  for (final d in const [6, 7, 1, 2, 3, 4, 5])
                    FilterChip(
                      label: Text(weekdayShort(l, d)),
                      selected: _weekdays.contains(d),
                      onSelected: (on) => setState(() {
                        on ? _weekdays.add(d) : _weekdays.remove(d);
                        if (_weekdays.length == 7) _weekdays = {};
                      }),
                    ),
                ],
              ),
              section(l.medDuration),
              Wrap(
                spacing: 8,
                children: [
                  ChoiceChip(
                    label: Text(l.ongoing),
                    selected: _endDate == null,
                    onSelected: (_) => setState(() => _endDate = null),
                  ),
                  ChoiceChip(
                    label: Text(_endDate == null
                        ? l.chooseEndDate
                        : l.untilDate(DateFormat.yMMMd(Localizations.localeOf(context).toLanguageTag())
                            .format(_endDate!))),
                    selected: _endDate != null,
                    onSelected: (_) => _pickEndDate(),
                  ),
                ],
              ),
              section(l.mealInstruction),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  for (final m in MealInstruction.values)
                    ChoiceChip(
                      label: Text(m.label(l)),
                      selected: _meal == m,
                      onSelected: (_) => setState(() => _meal = m),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _notes,
                maxLines: 2,
                decoration: InputDecoration(labelText: '${l.medNotes} (${l.optional})'),
              ),
              section(l.stockSection),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _stock,
                      keyboardType: TextInputType.number,
                      inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9٠-٩]'))],
                      decoration: InputDecoration(labelText: '${l.stockQty} (${l.optional})'),
                      validator: numberValidator,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      controller: _perDose,
                      keyboardType: TextInputType.number,
                      inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9٠-٩]'))],
                      decoration: InputDecoration(labelText: l.perDose),
                      validator: (v) => numberValidator(v, required: true),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 32),
              BusyButton(label: l.save, busy: _busy, onPressed: _save),
            ],
          ),
        ),
      ),
    );
  }
}

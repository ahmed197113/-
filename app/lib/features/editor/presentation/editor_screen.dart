import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';

import '../../../core/l10n/tr.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/files.dart';
import '../../credits/data/credits_repository.dart';
import '../../gallery/data/gallery_repository.dart';
import '../../settings/application/app_settings.dart';
import '../../templates/data/template_repository.dart';
import '../../templates/domain/occasion_template.dart';
import '../domain/editor_layer.dart';
import '../domain/font_catalog.dart';
import 'editor_canvas.dart';
import 'layer_widgets.dart';

class EditorArgs {
  const EditorArgs({required this.imageUri, required this.templateId, this.jobId = ''});
  final String imageUri;
  final String templateId;
  final String jobId;
}

enum _Panel { text, font, style, options, stickers }

const _palette = [
  Color(0xFFFFFFFF),
  Color(0xFFE8C873),
  Color(0xFFC9A24A),
  Color(0xFF0F1A2E),
  Color(0xFF000000),
  Color(0xFFE5484D),
  Color(0xFF006C35),
  Color(0xFF8A1538),
  Color(0xFF7FB7E8),
  Color(0xFFF2A7C3),
];

class EditorScreen extends ConsumerStatefulWidget {
  const EditorScreen({super.key, required this.args});
  final EditorArgs args;

  @override
  ConsumerState<EditorScreen> createState() => _EditorScreenState();
}

class _EditorScreenState extends ConsumerState<EditorScreen> {
  final _boundaryKey = GlobalKey();
  final _layers = <EditorLayer>[];
  String? _selectedId;
  _Panel _panel = _Panel.text;
  String? _localPath;
  double _aspect = 4 / 5;
  bool _exporting = false;
  OccasionTemplate? _template;

  // Gesture baselines.
  Offset _startPos = Offset.zero;
  double _startScale = 1;
  double _startRotation = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final path = await ensureLocalFile(widget.args.imageUri);
    final bytes = await File(path).readAsBytes();
    final codec = await ui.instantiateImageCodec(bytes);
    final frame = await codec.getNextFrame();
    final t = await ref.read(templateByIdProvider(widget.args.templateId).future);
    if (!mounted) return;
    setState(() {
      _localPath = path;
      _aspect = frame.image.width / frame.image.height;
      _template = t;
      final preset = t?.textPresets.isNotEmpty == true ? t!.textPresets.first : 'عيدكم مبارك';
      final layer = TextLayer(
        id: const Uuid().v4(),
        text: preset,
        fontFamily: t?.defaultFont ?? 'ArefRuqaa',
        color: t?.defaultTextColor ?? AppColors.goldLight,
        fill: TextFill.gold,
        position: Offset(.5, switch (t?.defaultTextPosition) {
          TextPosition.top => .14,
          TextPosition.center => .5,
          _ => .84,
        }),
      );
      _layers.add(layer);
      _selectedId = layer.id;
    });
    frame.image.dispose();
  }

  EditorLayer? get _selected => _layers.where((l) => l.id == _selectedId).firstOrNull;
  TextLayer? get _selectedText => _selected is TextLayer ? _selected as TextLayer : null;

  void _addText([String? text]) {
    final layer = TextLayer(
      id: const Uuid().v4(),
      text: text ?? 'اسمك هنا',
      fontFamily: _template?.defaultFont ?? 'ArefRuqaa',
      position: const Offset(.5, .5),
    );
    setState(() {
      _layers.add(layer);
      _selectedId = layer.id;
      _panel = _Panel.text;
    });
    if (text == null) _editText(layer);
  }

  Future<void> _editText(TextLayer layer) async {
    final controller = TextEditingController(text: layer.text);
    final result = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom, left: 16, right: 16, top: 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(ctx.tr('اكتب اسمك أو تهنئتك', 'Type your name or greeting'),
                style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              autofocus: true,
              maxLines: 3,
              minLines: 1,
              maxLength: 80,
              textAlign: TextAlign.center,
              style: TextStyle(fontFamily: layer.fontFamily, fontSize: 24),
            ),
            const SizedBox(height: 8),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, controller.text),
              child: Text(ctx.tr('تم', 'Done')),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
    if (result != null && result.trim().isNotEmpty) {
      setState(() => layer.text = result.trim());
      HapticFeedback.selectionClick();
    }
  }

  void _addSticker(StickerKind kind) {
    final layer = StickerLayer(id: const Uuid().v4(), kind: kind, color: _template?.coverStyle.colors[1] ?? AppColors.gold);
    setState(() {
      _layers.add(layer);
      _selectedId = layer.id;
    });
  }

  void _deleteSelected() {
    setState(() {
      _layers.removeWhere((l) => l.id == _selectedId);
      _selectedId = _layers.isEmpty ? null : _layers.last.id;
    });
  }

  Future<void> _export() async {
    final credits = ref.read(creditsRepositoryProvider).current;
    setState(() {
      _exporting = true;
      _selectedId = null;
    });
    await WidgetsBinding.instance.endOfFrame;
    try {
      final boundary = _boundaryKey.currentContext!.findRenderObject()! as RenderRepaintBoundary;
      // HD for everyone, 4K (2160 px wide) for Pro.
      final targetWidth = credits.isPro ? 2160.0 : 1080.0;
      final ratio = targetWidth / boundary.size.width;
      final image = await boundary.toImage(pixelRatio: ratio);
      final png = await image.toByteData(format: ui.ImageByteFormat.png);
      image.dispose();
      final dir = await getApplicationDocumentsDirectory();
      await Directory('${dir.path}/exports').create(recursive: true);
      final out = '${dir.path}/exports/munasaba_${DateTime.now().millisecondsSinceEpoch}.png';
      await File(out).writeAsBytes(png!.buffer.asUint8List());
      ref.read(galleryProvider.notifier).addAll(
            jobId: widget.args.jobId,
            templateId: widget.args.templateId,
            uris: [out],
            edited: true,
          );
      HapticFeedback.mediumImpact();
      if (mounted) context.push('/export', extra: out);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.tr('تعذّر حفظ الصورة، حاول مجدداً', 'Could not export, try again'))),
        );
      }
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final credits = ref.watch(creditStateProvider).value;
    final watermark = credits?.watermarked ?? true;
    return Scaffold(
      appBar: AppBar(
        title: Text(context.tr('أضف اسمك وتهنئتك', 'Add your text')),
        actions: [
          if (_selected != null)
            IconButton(
              tooltip: context.tr('حذف', 'Delete'),
              onPressed: _deleteSelected,
              icon: const Icon(Icons.delete_outline),
            ),
          Padding(
            padding: const EdgeInsetsDirectional.only(end: 8),
            child: TextButton.icon(
              onPressed: _localPath == null || _exporting ? null : _export,
              icon: _exporting
                  ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.ios_share, color: AppColors.gold),
              label: Text(context.tr('حفظ', 'Save'),
                  style: const TextStyle(color: AppColors.gold, fontWeight: FontWeight.w800)),
            ),
          ),
        ],
      ),
      body: _localPath == null
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => _selectedId = null),
                    onScaleStart: (d) {
                      final l = _selected;
                      if (l == null) return;
                      _startPos = l.position;
                      _startScale = l.scale;
                      _startRotation = l.rotation;
                    },
                    onScaleUpdate: (d) {
                      final l = _selected;
                      final box = _boundaryKey.currentContext?.findRenderObject() as RenderBox?;
                      if (l == null || box == null) return;
                      setState(() {
                        l.position = Offset(
                          (_startPos.dx + d.focalPointDelta.dx / box.size.width).clamp(0.0, 1.0),
                          (_startPos.dy + d.focalPointDelta.dy / box.size.height).clamp(0.0, 1.0),
                        );
                        _startPos = l.position;
                        if (d.pointerCount > 1) {
                          l.scale = (_startScale * d.scale).clamp(.3, 4.0);
                          l.rotation = _startRotation + d.rotation;
                        }
                      });
                    },
                    child: Center(
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: RepaintBoundary(
                          key: _boundaryKey,
                          child: EditorCanvas(
                            base: FileImage(File(_localPath!)),
                            aspectRatio: _aspect,
                            layers: _layers,
                            selectedId: _exporting ? null : _selectedId,
                            watermark: watermark,
                            onTapLayer: (id) => setState(() => _selectedId = id),
                            onDoubleTapLayer: (id) {
                              final l = _layers.firstWhere((x) => x.id == id);
                              if (l is TextLayer) _editText(l);
                            },
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                _buildPanel(context),
                _buildTabs(context),
              ],
            ),
    );
  }

  Widget _buildTabs(BuildContext context) {
    final items = [
      (_Panel.text, Icons.text_fields, context.tr('النص', 'Text')),
      (_Panel.font, Icons.font_download_outlined, context.tr('الخط', 'Font')),
      (_Panel.style, Icons.palette_outlined, context.tr('التنسيق', 'Style')),
      (_Panel.options, Icons.tune, context.tr('خيارات', 'Options')),
      (_Panel.stickers, Icons.auto_awesome, context.tr('زينة', 'Stickers')),
    ];
    return SafeArea(
      top: false,
      child: Row(
        children: [
          for (final (p, icon, label) in items)
            Expanded(
              child: InkWell(
                onTap: () => setState(() => _panel = p),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  child: Column(children: [
                    Icon(icon, color: _panel == p ? AppColors.gold : null),
                    const SizedBox(height: 4),
                    Text(label,
                        style: TextStyle(
                            fontSize: 12,
                            color: _panel == p ? AppColors.gold : null,
                            fontWeight: _panel == p ? FontWeight.w800 : FontWeight.w500)),
                  ]),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _needsText(BuildContext context) => Center(
        child: TextButton.icon(
          onPressed: () => _addText(),
          icon: const Icon(Icons.add),
          label: Text(context.tr('اختر نصاً أو أضف نصاً جديداً', 'Select or add a text')),
        ),
      );

  Widget _buildPanel(BuildContext context) {
    final t = _selectedText;
    final surface = Theme.of(context).colorScheme.surface;
    Widget child;
    switch (_panel) {
      case _Panel.text:
        final presets = {...?_template?.textPresets, 'عيدكم مبارك', 'كل عام وأنتم بخير', 'رمضان كريم', 'مبروك التخرج'}.toList();
        child = Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: t == null ? () => _addText() : () => _editText(t),
                  icon: const Icon(Icons.edit),
                  label: Text(t == null ? context.tr('أضف نصاً', 'Add text') : context.tr('تعديل النص', 'Edit text')),
                ),
              ),
              const SizedBox(width: 8),
              IconButton.filled(
                tooltip: context.tr('نص جديد', 'New text'),
                onPressed: () => _addText(),
                icon: const Icon(Icons.add),
              ),
            ]),
            const SizedBox(height: 10),
            SizedBox(
              height: 40,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  for (final p in presets)
                    Padding(
                      padding: const EdgeInsetsDirectional.only(end: 8),
                      child: ActionChip(
                        label: Text(p),
                        onPressed: () {
                          if (t == null) {
                            _addText(p);
                          } else {
                            setState(() => t.text = p);
                          }
                        },
                      ),
                    ),
                ],
              ),
            ),
          ],
        );
      case _Panel.font:
        if (t == null) {
          child = _needsText(context);
          break;
        }
        child = SizedBox(
          height: 96,
          child: ListView(
            scrollDirection: Axis.horizontal,
            children: [
              for (final f in kArabicFonts)
                GestureDetector(
                  onTap: () => setState(() => t.fontFamily = f.family),
                  child: Container(
                    width: 132,
                    margin: const EdgeInsetsDirectional.only(end: 8),
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Theme.of(context).cardTheme.color,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: t.fontFamily == f.family ? AppColors.gold : Colors.transparent, width: 2),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        // Live preview of the user's own text in each font.
                        Text(
                          t.displayText,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          textDirection: TextDirection.rtl,
                          style: TextStyle(fontFamily: f.family, fontSize: 20, height: 1.5),
                        ),
                        const SizedBox(height: 4),
                        Text(context.tr(f.nameAr, f.nameEn), style: const TextStyle(fontSize: 11)),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        );
      case _Panel.style:
        if (t == null) {
          child = _needsText(context);
          break;
        }
        child = Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              height: 40,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  _fillChip(t, TextFill.gold, context.tr('ذهبي', 'Gold'), kGoldGradient),
                  _fillChip(t, TextFill.silver, context.tr('فضي', 'Silver'), kSilverGradient),
                  for (final c in _palette)
                    GestureDetector(
                      onTap: () => setState(() {
                        t.fill = TextFill.solid;
                        t.color = c;
                      }),
                      child: Container(
                        width: 34,
                        height: 34,
                        margin: const EdgeInsetsDirectional.only(end: 8),
                        decoration: BoxDecoration(
                          color: c,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: t.fill == TextFill.solid && t.color == c ? AppColors.gold : Colors.white24,
                            width: t.fill == TextFill.solid && t.color == c ? 3 : 1,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            _slider(context.tr('الحجم', 'Size'), t.fontSize, 28, 160, (v) => t.fontSize = v),
            _slider(context.tr('الإطار', 'Stroke'), t.strokeWidth, 0, 8, (v) => t.strokeWidth = v),
          ],
        );
      case _Panel.options:
        if (t == null) {
          child = _needsText(context);
          break;
        }
        child = Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SwitchListTile(
              dense: true,
              title: Text(context.tr('ظل', 'Shadow')),
              value: t.shadow,
              onChanged: (v) => setState(() => t.shadow = v),
            ),
            SwitchListTile(
              dense: true,
              title: Text(context.tr('إظهار التشكيل', 'Show tashkeel')),
              value: t.showTashkeel,
              onChanged: (v) => setState(() => t.showTashkeel = v),
            ),
            SegmentedButton<DigitStyle>(
              segments: [
                ButtonSegment(value: DigitStyle.asTyped, label: Text(context.tr('كما كُتبت', 'As typed'))),
                const ButtonSegment(value: DigitStyle.arabicIndic, label: Text('١٢٣')),
                const ButtonSegment(value: DigitStyle.western, label: Text('123')),
              ],
              selected: {t.digits},
              onSelectionChanged: (s) => setState(() => t.digits = s.first),
            ),
          ],
        );
      case _Panel.stickers:
        child = SizedBox(
          height: 72,
          child: ListView(
            scrollDirection: Axis.horizontal,
            children: [
              for (final k in StickerKind.values)
                Padding(
                  padding: const EdgeInsetsDirectional.only(end: 10),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(14),
                    onTap: () => _addSticker(k),
                    child: Container(
                      width: 72,
                      decoration: BoxDecoration(
                        color: Theme.of(context).cardTheme.color,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Center(child: StickerPreview(kind: k, size: 52)),
                    ),
                  ),
                ),
            ],
          ),
        );
    }
    return Container(
      width: double.infinity,
      color: surface,
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
      constraints: const BoxConstraints(minHeight: 110),
      child: child,
    );
  }

  Widget _fillChip(TextLayer t, TextFill fill, String label, Gradient g) => Padding(
        padding: const EdgeInsetsDirectional.only(end: 8),
        child: GestureDetector(
          onTap: () => setState(() => t.fill = fill),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              gradient: g,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: t.fill == fill ? Colors.white : Colors.transparent, width: 2),
            ),
            child: Text(label, style: const TextStyle(color: AppColors.night, fontWeight: FontWeight.w800)),
          ),
        ),
      );

  Widget _slider(String label, double value, double min, double max, ValueChanged<double> set) => Row(
        children: [
          SizedBox(width: 56, child: Text(label, style: const TextStyle(fontSize: 13))),
          Expanded(
            child: Slider(
              value: value.clamp(min, max),
              min: min,
              max: max,
              onChanged: (v) => setState(() => set(v)),
            ),
          ),
        ],
      );
}

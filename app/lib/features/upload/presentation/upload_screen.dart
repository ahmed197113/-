import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/l10n/tr.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/common.dart';
import '../../credits/domain/credits.dart';
import '../../generation/data/generation_repository.dart';
import '../../generation/domain/generation_job.dart';
import '../data/face_check_service.dart';
import '../domain/selfie_check.dart';

class UploadScreen extends ConsumerStatefulWidget {
  const UploadScreen({super.key, required this.templateId, required this.gender});
  final String templateId;
  final String gender;

  @override
  ConsumerState<UploadScreen> createState() => _UploadScreenState();
}

class _UploadScreenState extends ConsumerState<UploadScreen> {
  static const maxPhotos = 3;
  final _picker = ImagePicker();
  final _checker = FaceCheckService();
  final _items = <_Selfie>[];
  String _aspect = '9:16';
  bool _starting = false;

  @override
  void dispose() {
    _checker.dispose();
    super.dispose();
  }

  Future<void> _pick(ImageSource source) async {
    try {
      final files = source == ImageSource.camera
          ? [await _picker.pickImage(source: source, preferredCameraDevice: CameraDevice.front, maxWidth: 2048, imageQuality: 95)]
              .whereType<XFile>()
              .toList()
          : await _picker.pickMultiImage(limit: maxPhotos - _items.length, maxWidth: 2048, imageQuality: 95);
      for (final f in files.take(maxPhotos - _items.length)) {
        final item = _Selfie(f.path);
        setState(() => _items.add(item));
        final result = await _checker.check(f.path);
        if (!mounted) return;
        setState(() => item.result = result);
        if (!result.ok) HapticFeedback.heavyImpact();
      }
    } on PlatformException {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(context.tr('اسمح للتطبيق بالوصول إلى الكاميرا والصور', 'Please allow camera/photos access')),
        ));
      }
    }
  }

  List<String> get _valid => _items.where((i) => i.result?.ok ?? false).map((i) => i.result!.croppedPath!).toList();

  Future<void> _start() async {
    setState(() => _starting = true);
    try {
      final id = await ref.read(generationRepositoryProvider).createJob(GenerationRequest(
            templateId: widget.templateId,
            selfiePaths: _valid,
            gender: widget.gender,
            aspectRatio: _aspect,
          ));
      if (mounted) context.pushReplacement('/generating/$id');
    } on InsufficientCreditsException {
      if (!mounted) return;
      final go = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text(ctx.tr('رصيدك انتهى', 'Out of credits')),
          content: Text(ctx.tr('اشحن رصيدك أو اشترك في Pro لإنشاء صور جديدة.', 'Top up or go Pro to create more photos.')),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(ctx.tr('لاحقاً', 'Later'))),
            FilledButton(
              style: FilledButton.styleFrom(minimumSize: const Size(100, 44)),
              onPressed: () => Navigator.pop(ctx, true),
              child: Text(ctx.tr('اشحن الآن', 'Top up')),
            ),
          ],
        ),
      );
      if (go == true && mounted) context.push('/store');
    } on GenerationException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.messageAr)));
    } finally {
      if (mounted) setState(() => _starting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final checking = _items.any((i) => i.result == null);
    return Scaffold(
      appBar: AppBar(
        title: Text(context.tr('ارفع صورك', 'Upload selfies')),
        actions: const [Padding(padding: EdgeInsetsDirectional.only(end: 12), child: CreditsBadge())],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            context.tr('من ١ إلى ٣ صور سيلفي واضحة لك وحدك. كلما كانت أوضح كانت النتيجة أجمل.',
                '1–3 clear selfies of just you. Clearer photos = better results.'),
            style: const TextStyle(fontSize: 15, height: 1.6),
          ),
          const SizedBox(height: 12),
          const _Tips(),
          const SizedBox(height: 16),
          GridView.count(
            crossAxisCount: 3,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
            childAspectRatio: 4 / 5,
            children: [
              for (final item in _items)
                _SelfieTile(item: item, onRemove: () => setState(() => _items.remove(item))),
              if (_items.length < maxPhotos)
                _AddTile(onCamera: () => _pick(ImageSource.camera), onGallery: () => _pick(ImageSource.gallery)),
            ],
          ),
          for (final item in _items.where((i) => i.result?.issue != null))
            Card(
              color: AppColors.danger.withValues(alpha: .12),
              margin: const EdgeInsets.only(top: 12),
              child: ListTile(
                leading: const Icon(Icons.error_outline, color: AppColors.danger),
                title: Text(item.result!.issue!.messageAr, style: const TextStyle(fontWeight: FontWeight.w700)),
                subtitle: Text('💡 ${item.result!.issue!.tipAr}'),
              ),
            ),
          const SizedBox(height: 20),
          Text(context.tr('مقاس الصورة', 'Format'), style: const TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          SegmentedButton<String>(
            segments: [
              ButtonSegment(value: '9:16', label: Text(context.tr('ستوري', 'Story')), icon: const Icon(Icons.stay_current_portrait)),
              ButtonSegment(value: '4:5', label: Text(context.tr('منشور', 'Post')), icon: const Icon(Icons.crop_portrait)),
              ButtonSegment(value: '1:1', label: Text(context.tr('مربع', 'Square')), icon: const Icon(Icons.crop_square)),
            ],
            selected: {_aspect},
            onSelectionChanged: (s) => setState(() => _aspect = s.first),
          ),
          const SizedBox(height: 24),
          FilledButton.icon(
            onPressed: _valid.isEmpty || checking || _starting ? null : _start,
            icon: _starting
                ? const SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.auto_awesome),
            label: Text(context.tr('أنشئ صوري', 'Create my photos')),
          ),
        ],
      ),
    );
  }
}

class _Selfie {
  _Selfie(this.path);
  final String path;
  SelfieCheckResult? result;
}

class _Tips extends StatelessWidget {
  const _Tips();

  @override
  Widget build(BuildContext context) {
    final tips = [
      (Icons.light_mode, context.tr('إضاءة أمامية', 'Front light')),
      (Icons.face, context.tr('وجهك فقط', 'Only you')),
      (Icons.center_focus_strong, context.tr('صورة واضحة', 'Sharp')),
      (Icons.no_photography_outlined, context.tr('بدون نظارة شمسية', 'No sunglasses')),
    ];
    return Row(
      children: [
        for (final (icon, label) in tips)
          Expanded(
            child: Column(children: [
              Icon(icon, color: AppColors.gold),
              const SizedBox(height: 4),
              Text(label, textAlign: TextAlign.center, style: const TextStyle(fontSize: 11)),
            ]),
          ),
      ],
    );
  }
}

class _SelfieTile extends StatelessWidget {
  const _SelfieTile({required this.item, required this.onRemove});
  final _Selfie item;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final r = item.result;
    return ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: Stack(fit: StackFit.expand, children: [
        Image.file(File(r?.croppedPath ?? item.path), fit: BoxFit.cover, cacheWidth: 400),
        if (r == null)
          const ColoredBox(color: Colors.black45, child: Center(child: CircularProgressIndicator())),
        if (r != null)
          PositionedDirectional(
            bottom: 6,
            start: 6,
            child: CircleAvatar(
              radius: 13,
              backgroundColor: r.ok ? AppColors.success : AppColors.danger,
              child: Icon(r.ok ? Icons.check : Icons.close, size: 16, color: Colors.white),
            ),
          ),
        PositionedDirectional(
          top: 2,
          end: 2,
          child: IconButton(
            visualDensity: VisualDensity.compact,
            style: IconButton.styleFrom(backgroundColor: Colors.black45),
            onPressed: onRemove,
            icon: const Icon(Icons.close, size: 16, color: Colors.white),
          ),
        ),
      ]),
    );
  }
}

class _AddTile extends StatelessWidget {
  const _AddTile({required this.onCamera, required this.onGallery});
  final VoidCallback onCamera;
  final VoidCallback onGallery;

  @override
  Widget build(BuildContext context) => InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => showModalBottomSheet<void>(
          context: context,
          builder: (ctx) => SafeArea(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              ListTile(
                leading: const Icon(Icons.photo_camera),
                title: Text(ctx.tr('التقط سيلفي', 'Take a selfie')),
                onTap: () {
                  Navigator.pop(ctx);
                  onCamera();
                },
              ),
              ListTile(
                leading: const Icon(Icons.photo_library),
                title: Text(ctx.tr('اختر من المعرض', 'Choose from gallery')),
                onTap: () {
                  Navigator.pop(ctx);
                  onGallery();
                },
              ),
            ]),
          ),
        ),
        child: Container(
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.gold.withValues(alpha: .6), width: 1.5),
            borderRadius: BorderRadius.circular(14),
          ),
          child: const Center(child: Icon(Icons.add_a_photo, color: AppColors.gold, size: 32)),
        ),
      );
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/config/providers.dart';
import '../../../core/l10n/tr.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/files.dart';
import '../../editor/presentation/editor_screen.dart';
import '../../gallery/data/gallery_repository.dart';
import '../data/generation_repository.dart';
import '../data/report_service.dart';
import '../domain/generation_job.dart';

class ResultsScreen extends ConsumerWidget {
  const ResultsScreen({super.key, required this.jobId});
  final String jobId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final job = ref.watch(jobProvider(jobId)).value ?? ref.read(generationRepositoryProvider).cached(jobId);
    return Scaffold(
      appBar: AppBar(
        title: Text(context.tr('صورك جاهزة ✨', 'Your photos are ready ✨')),
        leading: IconButton(icon: const Icon(Icons.close), onPressed: () => context.go('/home')),
      ),
      body: job == null || job.status != JobStatus.done
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(12),
              children: [
                if (job.isPreview)
                  Card(
                    color: AppColors.gold.withValues(alpha: .12),
                    child: ListTile(
                      leading: const Icon(Icons.info_outline, color: AppColors.gold),
                      title: Text(context.tr('معاينة على الجهاز', 'On-device preview')),
                      subtitle: Text(context.tr(
                        'هذه النسخة تعمل بدون خادم الذكاء الاصطناعي، فتصمّم بطاقة احتفالية من صورتك. عند ربط الخادم ستحصل على صور احترافية مولّدة بالذكاء الاصطناعي.',
                        'Running without the AI server: this is a festive card made from your selfie. With the backend connected you get AI portraits.',
                      )),
                    ),
                  ),
                GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    crossAxisSpacing: 10,
                    mainAxisSpacing: 10,
                    childAspectRatio: 9 / 14,
                  ),
                  itemCount: job.results.length,
                  itemBuilder: (context, i) => GestureDetector(
                    onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
                      builder: (_) => ResultViewer(uri: job.results[i], job: job),
                    )),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: Image(image: imageFor(job.results[i]), fit: BoxFit.cover),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  context.tr('اضغط على صورة لإضافة اسمك وتهنئتك بالخط العربي', 'Tap a photo to add your Arabic name & greeting'),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: () => context.push('/template/${job.templateId}'),
                  icon: const Icon(Icons.refresh),
                  label: Text(context.tr('أنشئ صوراً جديدة (يستهلك رصيداً)', 'Regenerate (uses a credit)')),
                ),
              ],
            ),
    );
  }
}

class ResultViewer extends ConsumerWidget {
  const ResultViewer({super.key, required this.uri, required this.job});
  final String uri;
  final GenerationJob job;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final gallery = ref.watch(galleryProvider);
    final item = gallery.where((g) => g.uri == uri).firstOrNull;
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        actions: [
          if (item != null)
            IconButton(
              tooltip: context.tr('مفضلة', 'Favorite'),
              onPressed: () => ref.read(galleryProvider.notifier).toggleFavorite(item.id),
              icon: Icon(item.favorite ? Icons.favorite : Icons.favorite_border, color: item.favorite ? AppColors.danger : null),
            ),
          IconButton(
            tooltip: context.tr('إبلاغ', 'Report'),
            onPressed: () => _report(context, ref),
            icon: const Icon(Icons.flag_outlined),
          ),
        ],
      ),
      body: Column(children: [
        Expanded(child: InteractiveViewer(child: Center(child: Image(image: imageFor(uri))))),
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: FilledButton.icon(
              onPressed: () => context.push('/editor',
                  extra: EditorArgs(imageUri: uri, templateId: job.templateId, jobId: job.id)),
              icon: const Icon(Icons.text_fields),
              label: Text(context.tr('أضف اسمك وتهنئتك', 'Add your name & greeting')),
            ),
          ),
        ),
      ]),
    );
  }

  Future<void> _report(BuildContext context, WidgetRef ref) async {
    final reason = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text(ctx.tr('ما المشكلة في هذه الصورة؟', "What's wrong with this image?"),
                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 17)),
          ),
          for (final r in ReportService.reasonsAr) ListTile(title: Text(r), onTap: () => Navigator.pop(ctx, r)),
        ]),
      ),
    );
    if (reason == null) return;
    await ReportService(ref.read(firebaseEnabledProvider)).report(jobId: job.id, imageUri: uri, reason: reason);
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.tr('شكراً، وصلنا بلاغك وسنراجعه.', 'Thanks — we will review your report.'))),
      );
    }
  }
}

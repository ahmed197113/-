import 'dart:async';
import 'dart:io';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';

import '../../../core/config/env.dart';
import '../../../core/config/providers.dart';
import '../../credits/data/credits_repository.dart';
import '../../credits/domain/credits.dart';
import '../../gallery/data/gallery_repository.dart';
import '../../templates/data/template_repository.dart';
import '../domain/generation_job.dart';
import 'preview_composer.dart';

class GenerationException implements Exception {
  const GenerationException(this.messageAr);
  final String messageAr;
}

abstract interface class GenerationRepository {
  /// Deducts credits and starts a job. Throws [InsufficientCreditsException]
  /// or [GenerationException].
  Future<String> createJob(GenerationRequest request);
  Stream<GenerationJob> watchJob(String jobId);
  GenerationJob? cached(String jobId);
}

/// Demo mode: on-device preview generation with the same credit semantics as
/// production (charge first, refund on failure).
class LocalGenerationRepository implements GenerationRepository {
  LocalGenerationRepository(this._ref);

  final Ref _ref;
  final _jobs = <String, GenerationJob>{};
  final _controllers = <String, StreamController<GenerationJob>>{};
  final _composer = const PreviewComposer();

  @override
  GenerationJob? cached(String jobId) => _jobs[jobId];

  void _update(GenerationJob job) {
    _jobs[job.id] = job;
    _controllers[job.id]?.add(job);
  }

  @override
  Future<String> createJob(GenerationRequest request) async {
    final template = await _ref.read(templateByIdProvider(request.templateId).future);
    if (template == null) throw const GenerationException('القالب غير متاح حالياً');
    final credits = _ref.read(creditsRepositoryProvider) as LocalCreditsRepository;
    if (template.isPremium && !credits.current.isPro) {
      throw const GenerationException('هذا القالب مميز ومتاح لمشتركي Pro');
    }
    final id = const Uuid().v4();
    credits.chargeForJob(id, template.creditsCost); // throws when insufficient
    final job = GenerationJob(
      id: id,
      templateId: template.id,
      status: JobStatus.queued,
      createdAt: DateTime.now(),
      watermarked: credits.current.watermarked,
      isPreview: true,
    );
    _controllers[id] = StreamController<GenerationJob>.broadcast();
    _update(job);
    unawaited(_run(job, request, credits));
    return id;
  }

  Future<void> _run(GenerationJob job, GenerationRequest req, LocalCreditsRepository credits) async {
    try {
      final template = (await _ref.read(templateByIdProvider(req.templateId).future))!;
      final dir = await getApplicationDocumentsDirectory();
      await Directory('${dir.path}/results').create(recursive: true);
      _update(job.copyWith(status: JobStatus.processing, progress: .08));
      final results = <String>[];
      for (var i = 0; i < req.variations; i++) {
        final out = '${dir.path}/results/${job.id}_$i.png';
        await _composer.compose(
          selfiePath: req.selfiePaths[i % req.selfiePaths.length],
          template: template,
          variation: i,
          aspect: req.aspectRatio,
          outPath: out,
        );
        results.add(out);
        // Paced so the progress animation stays readable.
        await Future<void>.delayed(const Duration(milliseconds: 450));
        _update(_jobs[job.id]!.copyWith(progress: .1 + .9 * (i + 1) / req.variations));
      }
      _ref.read(galleryProvider.notifier).addAll(jobId: job.id, templateId: template.id, uris: results);
      _update(_jobs[job.id]!.copyWith(status: JobStatus.done, progress: 1, results: results));
    } catch (_) {
      credits.refundJob(job.id);
      _update(_jobs[job.id]!.copyWith(
        status: JobStatus.failed,
        errorAr: 'تعذّر إنشاء الصور. أُعيد رصيدك تلقائياً.',
      ));
    }
  }

  @override
  Stream<GenerationJob> watchJob(String jobId) async* {
    final existing = _jobs[jobId];
    if (existing != null) yield existing;
    final c = _controllers[jobId];
    if (c != null) yield* c.stream;
  }
}

/// Production: selfies go to Storage, the callable deducts credits in a
/// Firestore transaction and the worker updates `jobs/{id}`.
class FirebaseGenerationRepository implements GenerationRepository {
  FirebaseGenerationRepository(this._ref);

  final Ref _ref;
  final _cache = <String, GenerationJob>{};
  final _seenDone = <String>{};

  FirebaseFirestore get _db => FirebaseFirestore.instance;

  @override
  GenerationJob? cached(String jobId) => _cache[jobId];

  @override
  Future<String> createJob(GenerationRequest request) async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) throw const GenerationException('يرجى تسجيل الدخول أولاً');
    final uploadId = const Uuid().v4();
    final paths = <String>[];
    try {
      for (var i = 0; i < request.selfiePaths.length; i++) {
        final path = 'uploads/$uid/$uploadId/$i.jpg';
        await FirebaseStorage.instance.ref(path).putFile(
              File(request.selfiePaths[i]),
              SettableMetadata(contentType: 'image/jpeg'),
            );
        paths.add(path);
      }
      String? fcmToken;
      try {
        fcmToken = await FirebaseMessaging.instance.getToken();
      } catch (_) {}
      final res = await FirebaseFunctions.instanceFor(region: Env.functionsRegion)
          .httpsCallable('createGenerationJob', options: HttpsCallableOptions(timeout: const Duration(seconds: 30)))
          .call<Map<String, dynamic>>({
        'templateId': request.templateId,
        'selfiePaths': paths,
        'gender': request.gender,
        'aspectRatio': request.aspectRatio,
        'variations': request.variations,
        'fcmToken': ?fcmToken,
      });
      return res.data['jobId'] as String;
    } on FirebaseFunctionsException catch (e) {
      if (e.code == 'resource-exhausted' && e.details?['reason'] == 'insufficient_credits') {
        throw const InsufficientCreditsException();
      }
      throw GenerationException(e.message ?? 'تعذّر بدء الإنشاء، حاول مجدداً.');
    } on FirebaseException {
      throw const GenerationException('تعذّر رفع الصور. تحقق من الإنترنت وحاول مجدداً.');
    } on SocketException {
      throw const GenerationException('لا يوجد اتصال بالإنترنت.');
    }
  }

  @override
  Stream<GenerationJob> watchJob(String jobId) {
    return _db.collection('jobs').doc(jobId).snapshots().asyncMap((doc) async {
      final d = doc.data() ?? const <String, dynamic>{};
      final status = JobStatus.values.firstWhere((s) => s.name == d['status'], orElse: () => JobStatus.queued);
      final paths = (d['result_paths'] as List?)?.cast<String>() ?? const [];
      final urls = <String>[];
      if (status == JobStatus.done) {
        for (final p in paths) {
          urls.add(await FirebaseStorage.instance.ref(p).getDownloadURL());
        }
      }
      final job = GenerationJob(
        id: jobId,
        templateId: d['template_id'] as String? ?? '',
        status: status,
        createdAt: (d['created_at'] as Timestamp?)?.toDate() ?? DateTime.now(),
        progress: (d['progress'] as num?)?.toDouble() ?? 0,
        results: urls,
        errorAr: d['error_ar'] as String?,
        watermarked: d['watermarked'] as bool? ?? true,
      );
      if (status == JobStatus.done && _seenDone.add(jobId)) {
        _ref.read(galleryProvider.notifier).addAll(jobId: jobId, templateId: job.templateId, uris: urls);
      }
      return _cache[jobId] = job;
    });
  }
}

final generationRepositoryProvider = Provider<GenerationRepository>((ref) {
  if (ref.watch(firebaseEnabledProvider)) return FirebaseGenerationRepository(ref);
  return LocalGenerationRepository(ref);
});

final jobProvider = StreamProvider.family<GenerationJob, String>(
  (ref, id) => ref.watch(generationRepositoryProvider).watchJob(id),
);

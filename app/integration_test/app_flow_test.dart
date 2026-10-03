import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:munasaba/app.dart';
import 'package:munasaba/core/config/providers.dart';
import 'package:munasaba/core/router/app_router.dart';
import 'package:munasaba/features/generation/data/generation_repository.dart';
import 'package:munasaba/features/generation/domain/generation_job.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Full flow on a real device/emulator with the on-device (mock) generator:
/// onboarding → guest → home → template → generation → results → editor → export.
void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  var surfaceConverted = false;
  Future<void> shot(WidgetTester tester, String name) async {
    await tester.pumpAndSettle(const Duration(milliseconds: 300));
    if (!surfaceConverted && Platform.isAndroid) {
      await binding.convertFlutterSurfaceToImage(); // once per test on Android
      surfaceConverted = true;
      await tester.pumpAndSettle();
    }
    await binding.takeScreenshot(name);
  }

  /// A synthetic "selfie" so the flow does not depend on the camera.
  Future<String> fakeSelfie() async {
    final rec = ui.PictureRecorder();
    final c = Canvas(rec);
    c.drawRect(const Rect.fromLTWH(0, 0, 800, 1000), Paint()..color = const Color(0xFF8899AA));
    c.drawOval(const Rect.fromLTWH(250, 250, 300, 380), Paint()..color = const Color(0xFFE0B89A));
    final img = await rec.endRecording().toImage(800, 1000);
    final png = await img.toByteData(format: ui.ImageByteFormat.png);
    final dir = await getTemporaryDirectory();
    final f = File('${dir.path}/fake_selfie.png');
    await f.writeAsBytes(png!.buffer.asUint8List());
    return f.path;
  }

  testWidgets('install → shared Eid photo', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final container = ProviderContainer(overrides: [sharedPrefsProvider.overrideWithValue(prefs)]);
    await tester.pumpWidget(UncontrolledProviderScope(container: container, child: const MunasabaApp()));
    await tester.pumpAndSettle();
    await shot(tester, '01_onboarding');

    await tester.tap(find.text('التالي'));
    await tester.pumpAndSettle();
    await shot(tester, '02_onboarding_arabic');
    await tester.tap(find.text('تخطٍّ'));
    await tester.pumpAndSettle();
    await shot(tester, '03_auth');

    await tester.tap(find.text('جرّب مجاناً الآن'));
    await tester.pumpAndSettle();
    expect(find.text('كل القوالب'), findsWidgets);
    await shot(tester, '04_home');

    container.read(routerProvider).push('/template/eid_elegant');
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('استخدم هذا القالب'), 300, scrollable: find.byType(Scrollable).first);
    await tester.pumpAndSettle();
    await shot(tester, '05_template');

    await tester.tap(find.text('استخدم هذا القالب'));
    await tester.pumpAndSettle();
    await shot(tester, '06_consent');

    // Generation (ML Kit checks are exercised on real selfies; here we feed the generator directly).
    final selfie = await fakeSelfie();
    final repo = container.read(generationRepositoryProvider);
    final jobId = await repo.createJob(GenerationRequest(
      templateId: 'eid_elegant',
      selfiePaths: [selfie],
      gender: 'male',
      aspectRatio: '9:16',
    ));
    container.read(routerProvider).go('/generating/$jobId');
    await tester.pump(const Duration(milliseconds: 600));
    await binding.takeScreenshot('07_generating');
    for (var i = 0; i < 60 && repo.cached(jobId)?.status != JobStatus.done; i++) {
      await tester.pump(const Duration(milliseconds: 500));
    }
    expect(repo.cached(jobId)?.status, JobStatus.done);
    await tester.pumpAndSettle();
    await shot(tester, '08_results');

    await tester.tap(find.byType(Image).first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('أضف اسمك وتهنئتك'));
    await tester.pumpAndSettle(const Duration(seconds: 1));
    await shot(tester, '09_editor');

    await tester.tap(find.text('الخط'));
    await tester.pumpAndSettle();
    await shot(tester, '10_editor_fonts');

    await tester.tap(find.text('حفظ'));
    await tester.pumpAndSettle(const Duration(seconds: 2));
    expect(find.text('شارك فرحتك'), findsOneWidget);
    await shot(tester, '11_export');

    container.read(routerProvider).go('/shop');
    await tester.pumpAndSettle();
    await shot(tester, '12_store');
  });
}

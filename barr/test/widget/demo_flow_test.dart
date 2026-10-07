import 'package:barr/app.dart';
import 'package:barr/core/config/app_config.dart';
import 'package:barr/core/services/service_providers.dart';
import 'package:barr/core/storage/prefs.dart';
import 'package:barr/features/elder_home/presentation/screens/elder_home_screen.dart';
import 'package:barr/features/family/presentation/screens/caregiver_home_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../helpers/fakes.dart';

/// Pumps frames without waiting for infinite animations (spinners, skeletons).
Future<void> settle(WidgetTester tester, [int frames = 20]) async {
  for (var i = 0; i < frames; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

late FakeReminderScheduler scheduler;
late FakeTts tts;

Future<void> pumpApp(WidgetTester tester) async {
  final prefs = await SharedPreferences.getInstance();
  await tester.pumpWidget(ProviderScope(
    overrides: [
      appConfigProvider.overrideWithValue(const AppConfig(flavor: Flavor.dev)),
      sharedPreferencesProvider.overrideWithValue(prefs),
      reminderSchedulerProvider.overrideWithValue(scheduler),
      ttsServiceProvider.overrideWithValue(tts),
    ],
    child: const BarrApp(),
  ));
  await settle(tester);
}

void main() {
  setUpAll(() => initializeDateFormatting());

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    scheduler = FakeReminderScheduler();
    tts = FakeTts();
  });

  Future<void> wait(WidgetTester tester, [int ms = 200]) async {
    await tester.runAsync(() => Future<void>.delayed(Duration(milliseconds: ms)));
    await settle(tester);
  }

  testWidgets('caregiver signs up, adds a parent and sets up the parent device', (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.5;
    addTearDown(tester.view.reset);
    tester.platformDispatcher.localesTestValue = const [Locale('ar')];
    addTearDown(tester.platformDispatcher.clearLocalesTestValue);

    await tester.runAsync(() async => pumpApp(tester));
    await settle(tester);

    // Onboarding → skip.
    expect(find.text('اطمئن على والديك كل يوم'), findsOneWidget);
    await tester.tap(find.text('تخطي'));
    await settle(tester);

    // Welcome → phone.
    await tester.tap(find.text('التسجيل برقم الجوال'));
    await settle(tester);
    await tester.enterText(find.byType(TextFormField), '0512345678');
    await tester.tap(find.text('إرسال الرمز'));
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 500)));
    await settle(tester);

    // OTP (demo code).
    expect(find.text('وضع التجربة: الرمز هو 123456'), findsOneWidget);
    await tester.enterText(find.byType(TextField), '123456');
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 500)));
    await settle(tester);

    // Account type → caregiver (default) + name.
    expect(find.text('من أنت؟'), findsOneWidget);
    await tester.enterText(find.byType(TextFormField), 'أحمد');
    await tester.tap(find.text('متابعة'));
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 200)));
    await settle(tester);

    // Create family.
    expect(find.text('أنشئ مساحة عائلتك'), findsOneWidget);
    await tester.enterText(find.byType(TextFormField), 'عائلة أحمد');
    await tester.tap(find.text('إنشاء العائلة'));
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 200)));
    await settle(tester);

    // Dashboard empty state.
    expect(find.byType(CaregiverHomeScreen), findsOneWidget);
    expect(find.text('لم تُضف والديك بعد'), findsOneWidget);

    // Add parent.
    await tester.tap(find.text('إضافة والد').first);
    await settle(tester);
    final fields = find.byType(TextFormField);
    await tester.enterText(fields.at(0), 'صالح');
    await tester.enterText(fields.at(1), 'بابا');
    await tester.tap(find.text('حفظ'));
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 200)));
    await settle(tester);

    // Link screen opens; go back and add a medicine first.
    expect(find.text('تجهيز هذا الجوال لوالدي الآن'), findsOneWidget);
    await tester.tap(find.byType(BackButton).last);
    await settle(tester);
    await tester.tap(find.text('بابا'));
    await settle(tester);
    expect(find.text('لا توجد أدوية بعد'), findsOneWidget);
    await tester.tap(find.text('إضافة دواء').first);
    await settle(tester);
    final medFields = find.byType(TextFormField);
    await tester.enterText(medFields.at(0), 'جلوكوفاج');
    await tester.enterText(medFields.at(1), 'حبة واحدة');
    await tester.scrollUntilVisible(find.text('حفظ'), 200, scrollable: find.ancestor(of: medFields.at(0), matching: find.byType(Scrollable)).first);
    await tester.tap(find.text('حفظ'));
    await wait(tester);
    expect(find.text('جلوكوفاج'), findsWidgets);
    expect(find.text('جدول اليوم'), findsOneWidget);
    await tester.tap(find.byType(BackButton).last);
    await settle(tester);
    await tester.tap(find.text('ربط جهاز الوالد'));
    await wait(tester);

    // Link screen shows a 6-digit code; use Setup Mode on this device.
    expect(find.text('تجهيز هذا الجوال لوالدي الآن'), findsOneWidget);
    await tester.tap(find.text('تجهيز هذا الجوال لوالدي الآن'));
    await settle(tester);
    await tester.tap(find.text('تأكيد'));
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 200)));
    await settle(tester, 30);

    // First launch on the parent's phone explains reminder permissions.
    expect(find.text('لنجهّز تذكيرات الدواء'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('تم'), 200,
        scrollable: find.byType(Scrollable).first);
    await tester.tap(find.text('تم'));
    await settle(tester);

    // Parent's simplified home; reminders were scheduled locally.
    expect(find.byType(ElderHomeScreen), findsOneWidget);
    expect(scheduler.synced.last, isNotEmpty);
    expect(scheduler.synced.last.first.title, contains('جلوكوفاج'));
    expect(find.text('أهلًا يا بابا'), findsOneWidget);
    for (final label in ['أدويتي اليوم', 'أنا بخير', 'اتصل بأولادي', 'طوارئ']) {
      expect(find.text(label), findsOneWidget, reason: label);
    }

    // Medicines: take the current dose.
    await tester.tap(find.text('أدويتي اليوم'));
    await wait(tester);
    expect(tts.spoken.last, contains('جلوكوفاج'));
    await tester.tap(find.text('أخذته').first);
    await wait(tester);
    expect(scheduler.cancelled, hasLength(1));
    expect(tts.spoken.last, 'أحسنت، الله يعطيك العافية');
    await tester.tap(find.byType(BackButtonIcon).last);
    await settle(tester);

    // "I'm fine" check-in.
    await tester.tap(find.text('أنا بخير'));
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 200)));
    await settle(tester);
    expect(find.textContaining('الحمد لله على سلامتك'), findsOneWidget);
    await tester.tap(find.text('إغلاق'));
    await settle(tester);
    expect(find.text('سجّلت اليوم أنك بخير'), findsOneWidget);

    // Unmount to dispose timers.
    await tester.pumpWidget(const SizedBox());
  });
}

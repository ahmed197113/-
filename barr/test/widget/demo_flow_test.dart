import 'package:barr/app.dart';
import 'package:barr/core/config/app_config.dart';
import 'package:barr/core/storage/prefs.dart';
import 'package:barr/features/elder_home/presentation/screens/elder_home_screen.dart';
import 'package:barr/features/family/presentation/screens/caregiver_home_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Pumps frames without waiting for infinite animations (spinners, skeletons).
Future<void> settle(WidgetTester tester, [int frames = 20]) async {
  for (var i = 0; i < frames; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

Future<void> pumpApp(WidgetTester tester) async {
  final prefs = await SharedPreferences.getInstance();
  await tester.pumpWidget(ProviderScope(
    overrides: [
      appConfigProvider.overrideWithValue(const AppConfig(flavor: Flavor.dev)),
      sharedPreferencesProvider.overrideWithValue(prefs),
    ],
    child: const BarrApp(),
  ));
  await settle(tester);
}

void main() {
  setUpAll(() => initializeDateFormatting());

  setUp(() => SharedPreferences.setMockInitialValues({}));

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

    // Link screen shows a 6-digit code; use Setup Mode on this device.
    expect(find.text('تجهيز هذا الجوال لوالدي الآن'), findsOneWidget);
    await tester.tap(find.text('تجهيز هذا الجوال لوالدي الآن'));
    await settle(tester);
    await tester.tap(find.text('تأكيد'));
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 200)));
    await settle(tester, 30);

    // Parent's simplified home.
    expect(find.byType(ElderHomeScreen), findsOneWidget);
    expect(find.text('أهلًا يا بابا'), findsOneWidget);
    for (final label in ['أدويتي اليوم', 'أنا بخير', 'اتصل بأولادي', 'طوارئ']) {
      expect(find.text(label), findsOneWidget, reason: label);
    }

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

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/config/env.dart';
import '../../../core/l10n/tr.dart';

class PrivacyScreen extends StatelessWidget {
  const PrivacyScreen({super.key});

  static const _ar = '''
سياسة الخصوصية — تطبيق «مناسبة»

١. ما نجمعه: صور السيلفي التي ترفعها، وبيانات الحساب (المعرّف، البريد أو رقم الهاتف إن سجّلت بهما)، وسجل الرصيد والمشتريات، وبيانات استخدام مجهولة لتحسين التطبيق.

٢. كيف نستخدم صورك: فقط لإنشاء صورك أنت بالقالب الذي تختاره. لا نستخدمها أبداً لتدريب أي نموذج ذكاء اصطناعي، ولا نبيعها ولا نشاركها لأي غرض تسويقي.

٣. مدة الاحتفاظ: صور السيلفي تُحذف تلقائياً خلال ٢٤ ساعة. الصور الناتجة تُحذف تلقائياً بعد ٣٠ يوماً.

٤. معالجة الصور: تُرسل الصور بشكل مشفّر إلى مزوّد توليد الصور لمعالجتها فقط، ولا يحق له الاحتفاظ بها أو استخدامها.

٥. الأطفال: التطبيق مخصص لمن هم ١٨ عاماً فأكثر. يُمنع رفع صور الأطفال.

٦. حقوقك: يمكنك في أي وقت حذف كل صورك أو حذف حسابك وكل بياناتك نهائياً من صفحة «حسابي»، أو طلب نسخة من بياناتك عبر البريد.

٧. الأمان: البيانات مخزّنة في خوادم Google Cloud في منطقة قريبة من المستخدمين، مع تشفير أثناء النقل والتخزين.

٨. نلتزم بنظام حماية البيانات الشخصية السعودي (PDPL) ومبادئ اللائحة الأوروبية (GDPR).

شروط الاستخدام: يُمنع رفع صور لأشخاص آخرين دون إذنهم، أو استخدام التطبيق لإنشاء محتوى مسيء أو مضلل. الرصيد غير قابل للاسترداد نقداً، ويُعاد تلقائياً إذا فشل الإنشاء.
''';

  static const _en = '''
Privacy Policy — Munasaba

1. What we collect: selfies you upload, account data (ID, email or phone if used), credit and purchase history, and anonymous usage analytics.

2. How we use your photos: only to generate your own images for the template you choose. Never used to train any AI model, never sold or shared for marketing.

3. Retention: selfies are deleted automatically within 24 hours. Generated results are deleted after 30 days.

4. Processing: photos are sent encrypted to our image-generation provider solely for processing; the provider may not retain or reuse them.

5. Children: the app is for users 18+. Uploading photos of children is not allowed.

6. Your rights: delete all your photos or your entire account at any time from Profile, or request an export of your data by email.

7. Security: data is stored on Google Cloud in a region close to our users, encrypted in transit and at rest.

8. We comply with the Saudi PDPL and GDPR principles.

Terms: do not upload photos of other people without consent, or use the app to create offensive or misleading content. Credits are non-refundable for cash and are automatically refunded when a generation fails.
''';

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: Text(context.tr('الخصوصية والشروط', 'Privacy & Terms'))),
        body: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Text(context.isArabic ? _ar : _en, style: const TextStyle(fontSize: 15, height: 1.8)),
            TextButton(
              onPressed: () => launchUrl(Uri.parse(Env.privacyUrl), mode: LaunchMode.externalApplication),
              child: Text(Env.privacyUrl),
            ),
          ],
        ),
      );
}

# تفعيل اللعب أونلاين (Firebase)

1. افتح https://console.firebase.google.com وسجّل بحساب جوجل.
2. **Add project / إضافة مشروع** ← اكتب اسم المشروع (مثلًا chess-academy) ← أوقف Google Analytics ← **Create**.
3. من القائمة: **Build ← Authentication ← Get started** ← اختر **Email/Password** ← فعّل أول مفتاح ← **Save**.
4. من القائمة: **Build ← Realtime Database ← Create database** ← اختر الموقع (مثلًا europe-west1) ← **Start in locked mode** ← **Enable**.
5. في نفس الصفحة افتح تبويب **Rules**، امسح الموجود والصق محتوى الملف `database.rules.json` ← **Publish**.
6. اضغط ⚙️ **Project settings** ← في الأسفل **Your apps** ← أيقونة الويب `</>` ← اكتب أي اسم ← **Register app**.
7. ستظهر لك فقرة `const firebaseConfig = { ... }` — انسخها كلها وأرسلها.

القيم في firebaseConfig ليست سرية (تُوضع داخل أي تطبيق)، والحماية تتم عبر القواعد في الخطوة 5.

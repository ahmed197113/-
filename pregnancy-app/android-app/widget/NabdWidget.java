package app.nabd.pregnancy;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;
import java.util.Calendar;
import java.util.Locale;
import java.util.TimeZone;
import org.json.JSONArray;
import org.json.JSONObject;

/** ويدجت «نبضٌ صغير» للشاشة الرئيسية: أسبوع الحمل وحجم الجنين والأيام الباقية (أو عمر الطفل).
 *  البيانات يكتبها التطبيق في CapacitorStorage تحت المفتاح nabd_widget، والحساب هنا يومياً بدون إنترنت. */
public class NabdWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, build(context));
    }

    /** تحديث فوري (عند الخروج من التطبيق) */
    public static void refreshAll(Context context) {
        AppWidgetManager m = AppWidgetManager.getInstance(context);
        int[] ids = m.getAppWidgetIds(new ComponentName(context, NabdWidget.class));
        if (ids != null && ids.length > 0) new NabdWidget().onUpdate(context, m, ids);
    }

    private static long dayNumber(int y, int m, int d) {
        Calendar c = Calendar.getInstance(TimeZone.getTimeZone("UTC"));
        c.clear();
        c.set(y, m - 1, d);
        return c.getTimeInMillis() / 86400000L;
    }

    private static long today() {
        Calendar n = Calendar.getInstance();
        return dayNumber(n.get(Calendar.YEAR), n.get(Calendar.MONTH) + 1, n.get(Calendar.DAY_OF_MONTH));
    }

    private static long parse(String iso) {
        String[] p = iso.split("-");
        return dayNumber(Integer.parseInt(p[0]), Integer.parseInt(p[1]), Integer.parseInt(p[2]));
    }

    // العدد مع المعدود بعربية صحيحة
    private static String count(long n, String one, String two, String few, String many) {
        if (n == 1) return one;
        if (n == 2) return two;
        return n <= 10 ? n + " " + few : n + " " + many;
    }

    // بالإنجليزية: 1 day / 5 days
    private static String countEn(long n, String unit) {
        return n + " " + unit + (n == 1 ? "" : "s");
    }

    static RemoteViews build(Context context) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.nabd_widget);
        // اللغة: التي اختارتها المستخدمة في التطبيق، وقبل أول فتح لغة الجهاز
        boolean en = !"ar".equals(Locale.getDefault().getLanguage());
        String big = en ? "Nabd" : "نبضٌ صغير", size = "", line = en ? "Open the app to start your journey 💗" : "افتحي التطبيق لبدء رحلتك 💗";
        try {
            SharedPreferences sp = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            String raw = sp.getString("nabd_widget", null);
            if (raw != null) {
                JSONObject o = new JSONObject(raw);
                en = "en".equals(o.optString("lang", en ? "en" : "ar"));
                String name = o.optString("name", "");
                long t = today();
                if (o.optString("baby", "").length() > 0) {
                    long days = Math.max(0, t - parse(o.getString("baby")));
                    big = name.isEmpty() ? (en ? "My baby 👶" : "طفلي 👶") : name + " 👶";
                    if (en) size = (days < 60 ? countEn(Math.max(1, days / 7), "week") : countEn((long) Math.floor(days / 30.44), "month")) + " old";
                    else size = days < 60 ? "عمره " + count(Math.max(1, days / 7), "أسبوع واحد", "أسبوعان", "أسابيع", "أسبوعاً")
                        : "عمره " + count((long) Math.floor(days / 30.44), "شهر واحد", "شهران", "أشهر", "شهراً");
                    line = en ? "Nabd 💗" : "نبضٌ صغير 💗";
                } else if (o.optString("due", "").length() > 0) {
                    long due = parse(o.getString("due"));
                    long days = Math.max(0, t - (due - 280));
                    long week = Math.min(40, Math.max(1, days / 7 + 1));
                    long left = due - t;
                    big = (en ? "Week " : "الأسبوع ") + week;
                    JSONArray sizes = o.optJSONArray("sizes");
                    if (sizes != null && week <= sizes.length()) size = (name.isEmpty() || en ? "" : name + " ") + sizes.optString((int) week - 1, "");
                    if (en) line = left > 0 ? countEn(left, "day") + " until we meet 💗" : left == 0 ? "Today is meeting day 💗" : "Meeting day is close 💗";
                    else line = left > 0 ? "باقٍ " + count(left, "يوم واحد", "يومان", "أيام", "يوماً") + " على اللقاء 💗"
                        : left == 0 ? "اليوم موعد اللقاء 💗" : "اقترب اللقاء 💗";
                }
            }
        } catch (Exception ignored) {
            // بيانات غير متوقعة: نعرض الرسالة الافتراضية
        }
        v.setTextViewText(R.id.nw_big, big);
        v.setTextViewText(R.id.nw_size, size);
        v.setTextViewText(R.id.nw_line, line);
        Intent i = new Intent(context, MainActivity.class);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(context, 0, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.nw_root, pi);
        return v;
    }
}

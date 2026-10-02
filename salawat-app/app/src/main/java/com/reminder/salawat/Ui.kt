package com.reminder.salawat

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.text.format.DateFormat
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import com.google.android.material.card.MaterialCardView
import com.reminder.salawat.databinding.ItemSettingRowBinding
import java.util.Locale

/** Wraps a permission launcher so callers can ask for a permission with a callback, from anywhere. */
class PermissionRequester(private val activity: ComponentActivity) {
    private val context: Context = activity
    private var callback: ((Boolean) -> Unit)? = null
    private var asked: String? = null
    private var hadRationale = false
    private val launcher = activity.registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        callback?.invoke(granted)
        callback = null
    }
    private var resolveCallback: ((Boolean) -> Unit)? = null
    private val resolver = activity.registerForActivityResult(ActivityResultContracts.StartIntentSenderForResult()) { result ->
        resolveCallback?.invoke(result.resultCode == android.app.Activity.RESULT_OK)
        resolveCallback = null
    }

    /** Shows a system dialog (e.g. Google's "turn on location") and reports whether the user accepted. */
    fun resolve(sender: android.content.IntentSender, onResult: (Boolean) -> Unit) {
        resolveCallback = onResult
        try {
            resolver.launch(androidx.activity.result.IntentSenderRequest.Builder(sender).build())
        } catch (e: Exception) {
            resolveCallback = null
            onResult(false)
        }
    }

    /**
     * True when the system will no longer show the permission prompt ("don't ask again" or denied twice),
     * so the only way forward is the app's settings page. Valid right after a denied [request].
     */
    fun isBlocked(permission: String): Boolean =
        ContextCompat.checkSelfPermission(context, permission) != PackageManager.PERMISSION_GRANTED &&
            asked == permission && !hadRationale && !activity.shouldShowRequestPermissionRationale(permission)

    fun request(permission: String, onResult: (Boolean) -> Unit) {
        if (ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED) {
            onResult(true)
            return
        }
        callback = onResult
        asked = permission
        hadRationale = activity.shouldShowRequestPermissionRationale(permission)
        launcher.launch(permission)
    }

    /** Notification permission only exists on Android 13+. */
    fun requestNotifications(onResult: (Boolean) -> Unit) {
        if (Build.VERSION.SDK_INT < 33) onResult(true) else request(Manifest.permission.POST_NOTIFICATIONS, onResult)
    }
}

interface PermissionHost {
    val permissions: PermissionRequester
}

/** Draws a run of text in the Mushaf font (KFGQPC HAFS), e.g. a surah name inside an interface sentence. */
class QuranFontSpan(private val typeface: android.graphics.Typeface) : android.text.style.MetricAffectingSpan() {
    override fun updateDrawState(tp: android.text.TextPaint) { tp.typeface = typeface }
    override fun updateMeasureState(tp: android.text.TextPaint) { tp.typeface = typeface }
}

object Ui {
    @Volatile private var quranTypeface: android.graphics.Typeface? = null

    fun quranTypeface(context: Context): android.graphics.Typeface? =
        quranTypeface ?: runCatching { androidx.core.content.res.ResourcesCompat.getFont(context, R.font.kfgqpc_hafs) }.getOrNull()
            .also { quranTypeface = it }

    /**
     * Uthmani surah names (e.g. سُورَةُ ٱلْفَاتِحَةِ) only render correctly in the Mushaf font: returns [text] with every
     * occurrence of [names] drawn in it.
     */
    fun quranNames(context: Context, text: String, vararg names: String): CharSequence {
        val tf = quranTypeface(context) ?: return text
        val sb = android.text.SpannableStringBuilder(text)
        for (name in names) {
            if (name.isEmpty()) continue
            var i = text.indexOf(name)
            while (i >= 0) {
                sb.setSpan(QuranFontSpan(tf), i, i + name.length, android.text.Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                i = text.indexOf(name, i + name.length)
            }
        }
        return sb
    }

    /** "15:05" → "3:05 م" when the phone uses 12-hour time. */
    fun time(context: Context, hhmm: String?): String {
        if (hhmm.isNullOrBlank()) return "--:--"
        if (DateFormat.is24HourFormat(context)) return hhmm
        val parts = hhmm.split(":")
        val h = parts.getOrNull(0)?.toIntOrNull() ?: return hhmm
        val m = parts.getOrNull(1) ?: return hhmm
        val suffix = if (h < 12) "ص" else "م"
        val h12 = when {
            h == 0 -> 12
            h > 12 -> h - 12
            else -> h
        }
        return "$h12:$m $suffix"
    }

    fun remaining(context: Context, targetMillis: Long): String {
        val totalMinutes = ((targetMillis - System.currentTimeMillis()) / 60_000L).coerceAtLeast(0).toInt() + 1
        val hours = totalMinutes / 60
        val minutes = totalMinutes % 60
        return if (hours > 0) context.getString(R.string.hours_minutes, hours, minutes)
        else context.getString(R.string.minutes_only, minutes)
    }

    fun countdown(millis: Long): String {
        val total = (millis / 1000).coerceAtLeast(0)
        return String.format(Locale.US, "%02d:%02d:%02d", total / 3600, (total % 3600) / 60, total % 60)
    }

    fun sectionTitle(parent: ViewGroup, text: String): TextView {
        val tv = TextView(parent.context, null, 0, R.style.SectionTitle)
        tv.layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        tv.text = text
        parent.addView(tv)
        return tv
    }

    /** A rounded card holding a vertical list of rows; returns the list container. */
    fun card(parent: ViewGroup): LinearLayout {
        val card = MaterialCardView(parent.context)
        card.layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        val list = LinearLayout(parent.context)
        list.orientation = LinearLayout.VERTICAL
        card.addView(list)
        parent.addView(card)
        return list
    }

    fun row(
        parent: ViewGroup,
        icon: Int,
        title: String,
        value: String? = null,
        switchChecked: Boolean? = null,
        onClick: (ItemSettingRowBinding) -> Unit
    ): ItemSettingRowBinding {
        if (parent.childCount > 0) {
            val divider = View(parent.context)
            val lp = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 1)
            lp.marginStart = (70 * parent.resources.displayMetrics.density).toInt()
            divider.layoutParams = lp
            divider.setBackgroundColor(ContextCompat.getColor(parent.context, R.color.outline))
            parent.addView(divider)
        }
        val b = ItemSettingRowBinding.inflate(LayoutInflater.from(parent.context), parent, true)
        b.iconSetting.setImageResource(icon)
        b.textSettingTitle.text = title
        b.textSettingValue.text = value.orEmpty()
        b.textSettingValue.visibility = if (value.isNullOrBlank()) View.GONE else View.VISIBLE
        if (switchChecked != null) {
            b.switchSetting.visibility = View.VISIBLE
            b.switchSetting.isChecked = switchChecked
            b.chevronSetting.visibility = View.GONE
        }
        b.root.setOnClickListener { onClick(b) }
        return b
    }

    fun setValue(b: ItemSettingRowBinding, value: String?) {
        b.textSettingValue.text = value.orEmpty()
        b.textSettingValue.visibility = if (value.isNullOrBlank()) View.GONE else View.VISIBLE
    }

    fun methodLabel(context: Context): String {
        val method = PrayerRepository.prefs(context).getInt(PrayerRepository.KEY_METHOD, PrayerRepository.DEFAULT_METHOD)
        val index = PrayerRepository.METHOD_IDS.indexOf(method).coerceAtLeast(0)
        return context.resources.getStringArray(R.array.prayer_method_labels)[index]
    }

    fun adhanLabel(context: Context): String {
        val id = AdhanCatalog.selectedId(context, fajrSlot = false)
        return when (id) {
            AdhanCatalog.NOTIFICATION_ONLY -> context.getString(R.string.adhan_notification_only)
            AdhanCatalog.CUSTOM -> context.getString(R.string.adhan_custom)
            else -> AdhanCatalog.byId(id)?.name ?: id
        }
    }

    fun intervalLabel(context: Context): String {
        val index = Prefs.INTERVAL_OPTIONS.indexOf(Prefs.reminderInterval(context)).coerceAtLeast(0)
        return context.resources.getStringArray(R.array.reminder_interval_labels)[index]
    }
}

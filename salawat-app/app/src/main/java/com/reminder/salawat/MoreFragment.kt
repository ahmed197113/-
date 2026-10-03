package com.reminder.salawat

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import com.reminder.salawat.databinding.FragmentMoreBinding

/** Every tool in the app, grouped so nothing is more than two taps away. */
class MoreFragment : Fragment(R.layout.fragment_more) {

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        val binding = FragmentMoreBinding.bind(view)
        val context = view.context
        val c = binding.moreContainer
        fun go(cls: Class<*>) = startActivity(Intent(context, cls))

        Ui.sectionTitle(c, getString(R.string.section_worship))
        val worship = Ui.card(c)
        Ui.row(worship, R.drawable.ic_check, getString(R.string.tool_tracker), getString(R.string.tool_tracker_desc)) { go(TrackerActivity::class.java) }
        Ui.row(worship, R.drawable.ic_touch, getString(R.string.more_tasbih), getString(R.string.more_tasbih_desc)) { go(TasbihActivity::class.java) }
        Ui.row(worship, R.drawable.ic_compass, getString(R.string.qibla_title), getString(R.string.more_qibla_desc)) { go(QiblaActivity::class.java) }
        Ui.row(worship, R.drawable.ic_volume, getString(R.string.tile_adhan), getString(R.string.more_adhan_desc)) { go(AdhanSettingsActivity::class.java) }
        Ui.row(worship, R.drawable.ic_moon, getString(R.string.ramadan_screen), getString(R.string.ramadan_desc)) { go(RamadanActivity::class.java) }
        Ui.row(worship, R.drawable.ic_bell, getString(R.string.tool_reminders), getString(R.string.tool_reminders_desc)) { go(RemindersActivity::class.java) }

        Ui.sectionTitle(c, getString(R.string.section_quran_sunnah))
        val sunnah = Ui.card(c)
        Ui.row(sunnah, R.drawable.ic_search, getString(R.string.tool_search), getString(R.string.tool_search_desc)) { go(QuranSearchActivity::class.java) }
        Ui.row(sunnah, R.drawable.ic_quran, getString(R.string.tool_hadith), getString(R.string.tool_hadith_desc)) { go(HadithBooksActivity::class.java) }
        Ui.row(sunnah, R.drawable.ic_star, getString(R.string.tool_names), getString(R.string.tool_names_desc)) { go(NamesActivity::class.java) }
        Ui.row(sunnah, R.drawable.ic_heart, getString(R.string.tool_ruqyah), getString(R.string.tool_ruqyah_desc)) { go(RuqyahActivity::class.java) }

        Ui.sectionTitle(c, getString(R.string.section_tools))
        val tools = Ui.card(c)
        Ui.row(tools, R.drawable.ic_clock, getString(R.string.tool_calendar), getString(R.string.tool_calendar_desc)) { go(CalendarActivity::class.java) }
        Ui.row(tools, R.drawable.ic_apps, getString(R.string.tool_zakat), getString(R.string.tool_zakat_desc)) { go(ZakatActivity::class.java) }
        Ui.row(tools, R.drawable.ic_location, getString(R.string.tool_mosques), getString(R.string.tool_mosques_desc)) { openMosques(context) }
        Ui.row(tools, R.drawable.ic_settings, getString(R.string.settings_title), getString(R.string.more_settings_desc)) { go(SettingsActivity::class.java) }

        Ui.sectionTitle(c, getString(R.string.more_about))
        val about = Ui.card(c)
        Ui.row(about, R.drawable.ic_share, getString(R.string.more_share), getString(R.string.more_share_desc)) {
            startActivity(
                Intent.createChooser(
                    Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, getString(R.string.more_share_text)),
                    null
                )
            )
        }
        val version = context.packageManager.getPackageInfo(context.packageName, 0).versionName
        Ui.row(about, R.drawable.ic_heart, getString(R.string.more_about), getString(R.string.more_about_desc, version)) {
            AlertDialog.Builder(context)
                .setTitle(R.string.app_name)
                .setMessage(R.string.about_text)
                .setPositiveButton(android.R.string.ok, null)
                .show()
        }
        Ui.row(about, R.drawable.ic_quran, getString(R.string.licenses_title), getString(R.string.licenses_desc)) {
            AlertDialog.Builder(context)
                .setTitle(R.string.licenses_title)
                .setMessage(R.string.licenses_text)
                .setPositiveButton(android.R.string.ok, null)
                .show()
        }
    }

    companion object {
        fun openMosques(context: Context) {
            try {
                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=" + Uri.encode("مسجد"))))
            } catch (e: ActivityNotFoundException) {
                try {
                    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com/maps/search/" + Uri.encode("مسجد"))))
                } catch (e2: ActivityNotFoundException) {
                    Toast.makeText(context, R.string.no_maps_app, Toast.LENGTH_SHORT).show()
                }
            }
        }
    }
}

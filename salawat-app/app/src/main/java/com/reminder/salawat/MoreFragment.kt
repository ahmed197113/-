package com.reminder.salawat

import android.content.Intent
import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import com.reminder.salawat.databinding.FragmentMoreBinding

class MoreFragment : Fragment(R.layout.fragment_more) {

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        val binding = FragmentMoreBinding.bind(view)
        val context = view.context
        val container = binding.moreContainer

        Ui.sectionTitle(container, getString(R.string.quick_access))
        val tools = Ui.card(container)
        Ui.row(tools, R.drawable.ic_touch, getString(R.string.more_tasbih), getString(R.string.more_tasbih_desc)) {
            startActivity(Intent(context, TasbihActivity::class.java))
        }
        Ui.row(tools, R.drawable.ic_compass, getString(R.string.qibla_title), getString(R.string.more_qibla_desc)) {
            startActivity(Intent(context, QiblaActivity::class.java))
        }
        Ui.row(tools, R.drawable.ic_volume, getString(R.string.tile_adhan), getString(R.string.more_adhan_desc)) {
            startActivity(Intent(context, AdhanSettingsActivity::class.java))
        }
        Ui.row(tools, R.drawable.ic_settings, getString(R.string.settings_title), getString(R.string.more_settings_desc)) {
            startActivity(Intent(context, SettingsActivity::class.java))
        }

        Ui.sectionTitle(container, getString(R.string.more_about))
        val about = Ui.card(container)
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
                .setTitle(R.string.more_about)
                .setMessage(R.string.about_text)
                .setPositiveButton(android.R.string.ok, null)
                .show()
        }
    }
}

package com.reminder.salawat

import android.app.Application
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.viewModelScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.reminder.salawat.databinding.ActivityAdhanSettingsBinding
import com.reminder.salawat.databinding.ItemAdhanBinding
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

class AdhanSettingsViewModel(app: Application) : AndroidViewModel(app) {
    /** Download progress per sound id (0..100); absent = not downloading. */
    val progress = HashMap<String, Int>()
    val changed = MutableLiveData(0)
    val failed = MutableLiveData<Long>()
    val previewing = MutableLiveData<String?>(null)
    /** Id to select once its download finishes, with the slot it was chosen for. */
    private val pendingSelection = HashMap<String, Boolean>()

    private val preview = AudioPlayer(app) { previewing.value = null }

    private fun bump() {
        changed.value = (changed.value ?: 0) + 1
    }

    fun download(sound: AdhanSound, selectForFajr: Boolean) {
        pendingSelection[sound.id] = selectForFajr
        if (progress.containsKey(sound.id)) return
        progress[sound.id] = 0
        bump()
        viewModelScope.launch {
            try {
                AdhanCatalog.download(getApplication(), sound) { percent ->
                    progress[sound.id] = percent
                    bump()
                }
                pendingSelection.remove(sound.id)?.let { fajr -> select(sound.id, fajr) }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                pendingSelection.remove(sound.id)
                failed.value = System.currentTimeMillis()
            } finally {
                progress.remove(sound.id)
                bump()
            }
        }
    }

    fun select(id: String, fajrSlot: Boolean) {
        Prefs.get(getApplication()).edit().putString(if (fajrSlot) Prefs.KEY_ADHAN_FAJR else Prefs.KEY_ADHAN, id).apply()
        bump()
    }

    fun togglePreview(id: String) {
        if (previewing.value == id) {
            preview.stop()
            previewing.value = null
            return
        }
        val app = getApplication<Application>()
        previewing.value = id
        val local = AdhanCatalog.uriFor(app, id)
        if (local != null) preview.play(local) else preview.play(AdhanCatalog.streamUrl(id))
    }

    override fun onCleared() {
        preview.stop()
    }
}

class AdhanSettingsActivity : LocalizedActivity() {

    private lateinit var binding: ActivityAdhanSettingsBinding
    private val viewModel: AdhanSettingsViewModel by viewModels()
    private val adapter = AdhanAdapter()
    private val fajrSlot get() = binding.groupSlot.checkedButtonId == R.id.btnSlotFajr

    private val pickFile = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
        if (uri == null) return@registerForActivityResult
        runCatching { contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION) }
        Prefs.get(this).edit().putString(Prefs.KEY_ADHAN_CUSTOM_URI, uri.toString()).apply()
        viewModel.select(AdhanCatalog.CUSTOM, fajrSlot)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityAdhanSettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.recyclerAdhans.layoutManager = LinearLayoutManager(this)
        binding.recyclerAdhans.adapter = adapter
        binding.toolbar.toolbar.setTitle(R.string.adhan_title)
        binding.toolbar.toolbar.setNavigationOnClickListener { finish() }
        binding.groupSlot.addOnButtonCheckedListener { _, _, checked -> if (checked) adapter.reload() }
        binding.btnPickFile.setOnClickListener { pickFile.launch(arrayOf("audio/*")) }
        binding.btnTest.setOnClickListener {
            viewModel.previewing.value?.let { viewModel.togglePreview(it) }
            val prayer = if (fajrSlot) Prayer.FAJR else Prayer.DHUHR
            val uri = AdhanCatalog.sourceFor(this, prayer)
            if (uri == null || !AdhanService.start(this, prayer, uri)) postPrayerNotification(this, prayer)
        }

        viewModel.changed.observe(this) { adapter.reload() }
        viewModel.previewing.observe(this) { adapter.reload() }
        viewModel.failed.observe(this) { Toast.makeText(this, R.string.adhan_download_failed, Toast.LENGTH_SHORT).show() }
    }

    override fun onDestroy() {
        if (isFinishing) viewModel.previewing.value?.let { viewModel.togglePreview(it) }
        super.onDestroy()
    }

    private data class Row(val id: String, val name: String, val sound: AdhanSound?)

    inner class AdhanAdapter : RecyclerView.Adapter<AdhanAdapter.ViewHolder>() {
        private var rows: List<Row> = emptyList()

        @android.annotation.SuppressLint("NotifyDataSetChanged")
        fun reload() {
            val list = ArrayList<Row>()
            if (fajrSlot) list.add(Row(AdhanCatalog.SAME_AS_OTHERS, getString(R.string.adhan_same_as_others), null))
            val sounds = if (fajrSlot) AdhanCatalog.ALL.sortedByDescending { it.fajr } else AdhanCatalog.ALL.filter { !it.fajr }
            sounds.forEach { list.add(Row(it.id, it.name, it)) }
            if (Prefs.get(this@AdhanSettingsActivity).getString(Prefs.KEY_ADHAN_CUSTOM_URI, null) != null) {
                list.add(Row(AdhanCatalog.CUSTOM, getString(R.string.adhan_custom), null))
            }
            list.add(Row(AdhanCatalog.NOTIFICATION_ONLY, getString(R.string.adhan_notification_only), null))
            rows = list
            notifyDataSetChanged()
        }

        inner class ViewHolder(val binding: ItemAdhanBinding) : RecyclerView.ViewHolder(binding.root)

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
            ViewHolder(ItemAdhanBinding.inflate(LayoutInflater.from(parent.context), parent, false))

        override fun getItemCount() = rows.size

        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val row = rows[position]
            val b = holder.binding
            val context = this@AdhanSettingsActivity
            val selected = AdhanCatalog.selectedId(context, fajrSlot) == row.id
            val available = AdhanCatalog.isAvailable(context, row.id)
            val progress = viewModel.progress[row.id]
            b.radioSelected.isChecked = selected
            b.textAdhanName.text = row.name
            b.progressDownload.visibility = if (progress != null) View.VISIBLE else View.GONE
            b.progressDownload.progress = progress ?: 0
            b.textAdhanStatus.visibility = if (row.sound != null) View.VISIBLE else View.GONE
            b.textAdhanStatus.text = when {
                progress != null -> getString(R.string.adhan_status_downloading, progress)
                row.id == AdhanCatalog.BUNDLED -> getString(R.string.adhan_status_bundled)
                available -> getString(R.string.adhan_status_ready)
                else -> getString(R.string.adhan_status_download)
            }
            val canPreview = row.sound != null || row.id == AdhanCatalog.CUSTOM
            b.btnPreview.visibility = if (canPreview) View.VISIBLE else View.INVISIBLE
            b.btnPreview.setImageResource(if (viewModel.previewing.value == row.id) R.drawable.ic_stop else R.drawable.ic_play)
            b.btnPreview.setOnClickListener { viewModel.togglePreview(row.id) }
            holder.itemView.setOnClickListener {
                if (row.sound != null && !available) viewModel.download(row.sound, fajrSlot)
                else viewModel.select(row.id, fajrSlot)
            }
        }
    }
}

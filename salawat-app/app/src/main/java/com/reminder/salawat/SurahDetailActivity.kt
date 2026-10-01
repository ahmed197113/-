package com.reminder.salawat

import android.app.Application
import android.os.Bundle
import android.util.TypedValue
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.viewModelScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.reminder.salawat.databinding.ActivitySurahDetailBinding
import com.reminder.salawat.databinding.ItemAyahBinding
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

class SurahDetailViewModel(app: Application) : AndroidViewModel(app) {
    var surahNumber = -1
    val detail = MutableLiveData<SurahDetail?>(null)
    val loading = MutableLiveData(false)
    val failed = MutableLiveData(false)

    /** Index of the ayah currently playing, or -1. */
    val playingIndex = MutableLiveData(-1)
    var playAll = false
        private set

    /** Tafsir text per ayah number for the expanded rows; null value = loading. */
    val expandedTafsir = LinkedHashMap<Int, String?>()
    val tafsirChanged = MutableLiveData<Int>()
    private var tafsirMap: Map<Int, String>? = null
    private var tafsirLoading = false

    private val player = AudioPlayer { completed ->
        val index = playingIndex.value ?: -1
        val ayahs = detail.value?.ayahs.orEmpty()
        if (completed && playAll && index + 1 < ayahs.size) playIndex(index + 1, continuous = true)
        else stopAudio()
    }

    fun load(number: Int) {
        surahNumber = number
        if (detail.value != null || loading.value == true) return
        loading.value = true
        failed.value = false
        viewModelScope.launch {
            try {
                detail.value = QuranApi.fetchSurahText(getApplication(), number)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                failed.value = true
            } finally {
                loading.value = false
            }
        }
    }

    fun playIndex(index: Int, continuous: Boolean) {
        val ayah = detail.value?.ayahs?.getOrNull(index) ?: return
        playAll = continuous
        playingIndex.value = index
        player.play(ayah.audioUrl)
    }

    fun stopAudio() {
        playAll = false
        player.stop()
        playingIndex.value = -1
    }

    fun toggleTafsir(ayahNumber: Int) {
        if (expandedTafsir.containsKey(ayahNumber)) {
            expandedTafsir.remove(ayahNumber)
            tafsirChanged.value = ayahNumber
            return
        }
        val map = tafsirMap
        if (map != null) {
            expandedTafsir[ayahNumber] = map[ayahNumber] ?: getApplication<Application>().getString(R.string.quran_tafsir_unavailable)
            tafsirChanged.value = ayahNumber
            return
        }
        expandedTafsir[ayahNumber] = null
        tafsirChanged.value = ayahNumber
        if (tafsirLoading) return
        tafsirLoading = true
        viewModelScope.launch {
            val app = getApplication<Application>()
            val result = try {
                QuranApi.fetchTafsir(app, surahNumber)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                null
            }
            tafsirLoading = false
            tafsirMap = result
            // Fill every row that was waiting, then let failed rows be retried by tapping again.
            for (key in expandedTafsir.keys.toList()) {
                if (expandedTafsir[key] != null) continue
                if (result == null) expandedTafsir.remove(key)
                else expandedTafsir[key] = result[key] ?: app.getString(R.string.quran_tafsir_unavailable)
                tafsirChanged.value = key
            }
            if (result == null) Toast.makeText(app, R.string.quran_tafsir_error, Toast.LENGTH_SHORT).show()
        }
    }

    override fun onCleared() {
        player.stop()
    }
}

class SurahDetailActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySurahDetailBinding
    private val viewModel: SurahDetailViewModel by viewModels()
    private lateinit var adapter: AyahAdapter
    private var surahNumber = -1
    private var surahName = ""
    private var pendingScrollAyah = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySurahDetailBinding.inflate(layoutInflater)
        setContentView(binding.root)

        surahNumber = intent.getIntExtra(EXTRA_SURAH_NUMBER, -1)
        surahName = intent.getStringExtra(EXTRA_SURAH_NAME) ?: getString(R.string.quran_title)
        if (savedInstanceState == null) pendingScrollAyah = intent.getIntExtra(EXTRA_AYAH, 0)
        binding.textHeaderTitle.text = surahName

        val prefs = Prefs.get(this)
        adapter = AyahAdapter(
            viewModel = viewModel,
            fontSp = prefs.getFloat(Prefs.KEY_QURAN_FONT, 22f),
            onBookmark = { ayah ->
                saveLastRead(ayah)
                Toast.makeText(this, getString(R.string.quran_bookmark_saved, ayah), Toast.LENGTH_SHORT).show()
            }
        )
        binding.recyclerAyahs.layoutManager = LinearLayoutManager(this)
        binding.recyclerAyahs.adapter = adapter

        binding.btnRetry.setOnClickListener { viewModel.load(surahNumber) }
        binding.btnPlayAll.setOnClickListener {
            if ((viewModel.playingIndex.value ?: -1) >= 0) viewModel.stopAudio()
            else viewModel.playIndex(firstVisibleIndex(), continuous = true)
        }
        binding.btnFontSmaller.setOnClickListener { changeFont(-2f) }
        binding.btnFontBigger.setOnClickListener { changeFont(2f) }

        viewModel.loading.observe(this) { binding.progressBar.visibility = if (it) View.VISIBLE else View.GONE }
        viewModel.failed.observe(this) { failed ->
            binding.layoutError.visibility = if (failed) View.VISIBLE else View.GONE
            binding.textError.text = getString(R.string.quran_fetch_error)
        }
        viewModel.detail.observe(this) { detail ->
            if (detail == null) return@observe
            binding.toolbarControls.visibility = View.VISIBLE
            adapter.submit(detail.ayahs)
            if (pendingScrollAyah > 0) {
                (binding.recyclerAyahs.layoutManager as LinearLayoutManager)
                    .scrollToPositionWithOffset((pendingScrollAyah - 1).coerceIn(0, detail.ayahs.size - 1), 0)
                pendingScrollAyah = 0
            }
        }
        viewModel.playingIndex.observe(this) { index ->
            val previous = adapter.playingIndex
            adapter.playingIndex = index
            if (previous >= 0) adapter.notifyItemChanged(previous)
            if (index >= 0) {
                adapter.notifyItemChanged(index)
                if (viewModel.playAll) binding.recyclerAyahs.smoothScrollToPosition(index)
            }
            binding.btnPlayAll.setText(if (index >= 0) R.string.quran_stop else R.string.quran_play_all)
        }
        viewModel.tafsirChanged.observe(this) { ayahNumber -> adapter.notifyItemChanged(ayahNumber - 1) }

        viewModel.load(surahNumber)
    }

    override fun onPause() {
        super.onPause()
        if (viewModel.detail.value != null) saveLastRead(firstVisibleIndex() + 1)
    }

    override fun onDestroy() {
        // Stop audio when the user leaves the screen, but keep it playing across rotation.
        if (isFinishing) viewModel.stopAudio()
        super.onDestroy()
    }

    private fun firstVisibleIndex(): Int =
        (binding.recyclerAyahs.layoutManager as LinearLayoutManager).findFirstVisibleItemPosition().coerceAtLeast(0)

    private fun saveLastRead(ayah: Int) {
        Prefs.get(this).edit()
            .putInt(Prefs.KEY_LAST_SURAH, surahNumber)
            .putString(Prefs.KEY_LAST_SURAH_NAME, surahName)
            .putInt(Prefs.KEY_LAST_AYAH, ayah)
            .apply()
    }

    private fun changeFont(delta: Float) {
        val size = (adapter.fontSp + delta).coerceIn(16f, 40f)
        Prefs.get(this).edit().putFloat(Prefs.KEY_QURAN_FONT, size).apply()
        adapter.fontSp = size
        @Suppress("NotifyDataSetChanged")
        adapter.notifyDataSetChanged()
    }

    class AyahAdapter(
        private val viewModel: SurahDetailViewModel,
        var fontSp: Float,
        private val onBookmark: (Int) -> Unit
    ) : RecyclerView.Adapter<AyahAdapter.ViewHolder>() {
        private var items: List<Ayah> = emptyList()
        var playingIndex = -1

        @android.annotation.SuppressLint("NotifyDataSetChanged")
        fun submit(list: List<Ayah>) {
            items = list
            notifyDataSetChanged()
        }

        class ViewHolder(val binding: ItemAyahBinding) : RecyclerView.ViewHolder(binding.root)

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
            ViewHolder(ItemAyahBinding.inflate(LayoutInflater.from(parent.context), parent, false))

        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val item = items[position]
            val b = holder.binding
            val context = holder.itemView.context
            b.textAyahText.text = item.text
            b.textAyahText.setTextSize(TypedValue.COMPLEX_UNIT_SP, fontSp)
            b.textAyahNumber.text = context.getString(R.string.quran_ayah_number, item.numberInSurah)

            val playing = position == playingIndex
            b.cardAyah.setCardBackgroundColor(
                ContextCompat.getColor(context, if (playing) R.color.highlight else R.color.card_light)
            )
            b.btnPlayAyahAudio.setImageResource(if (playing) R.drawable.ic_stop else R.drawable.ic_play)
            b.btnPlayAyahAudio.visibility = if (item.audioUrl.isBlank()) View.GONE else View.VISIBLE
            b.btnPlayAyahAudio.setOnClickListener {
                val pos = holder.bindingAdapterPosition
                if (pos == RecyclerView.NO_POSITION) return@setOnClickListener
                if (pos == playingIndex) viewModel.stopAudio() else viewModel.playIndex(pos, continuous = false)
            }

            // Tafsir state lives in the ViewModel, so recycled rows never show another ayah's tafsir.
            if (viewModel.expandedTafsir.containsKey(item.numberInSurah)) {
                b.textTafsir.text = viewModel.expandedTafsir[item.numberInSurah] ?: context.getString(R.string.quran_loading)
                b.textTafsir.visibility = View.VISIBLE
            } else {
                b.textTafsir.visibility = View.GONE
            }
            b.btnTafsir.setOnClickListener { viewModel.toggleTafsir(item.numberInSurah) }
            b.btnBookmark.setOnClickListener { onBookmark(item.numberInSurah) }
        }

        override fun getItemCount() = items.size
    }

    companion object {
        const val EXTRA_SURAH_NUMBER = "surah_number"
        const val EXTRA_SURAH_NAME = "surah_name"
        const val EXTRA_AYAH = "ayah"
    }
}

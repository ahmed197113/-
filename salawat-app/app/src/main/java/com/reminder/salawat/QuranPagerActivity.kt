package com.reminder.salawat

import android.app.Application
import android.content.Intent
import android.graphics.Typeface
import android.os.Build
import android.os.Bundle
import android.text.Layout
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.TextPaint
import android.text.method.LinkMovementMethod
import android.text.style.AlignmentSpan
import android.text.style.BackgroundColorSpan
import android.text.style.ClickableSpan
import android.text.style.ForegroundColorSpan
import android.text.style.RelativeSizeSpan
import android.text.style.StyleSpan
import android.util.TypedValue
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.activity.viewModels
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.RecyclerView
import androidx.viewpager2.widget.ViewPager2
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.reminder.salawat.databinding.ActivityQuranPagerBinding
import com.reminder.salawat.databinding.ItemQuranPageBinding
import com.reminder.salawat.databinding.SheetAyahBinding
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

class QuranViewModel(app: Application) : AndroidViewModel(app) {
    /** Global number of the ayah being recited, or -1. */
    val playingGlobal = MutableLiveData(-1)
    val buffering = MutableLiveData(false)
    val audioError = MutableLiveData<Long>()
    private var continuous = false
    private var stopAtGlobal = Int.MAX_VALUE

    private val player = AudioPlayer(
        context = app,
        onStarted = { buffering.value = false },
        onFinished = { completed -> onTrackFinished(completed) }
    )

    /** Plays [global]; when [continuous], keeps going (optionally only up to [untilGlobal]). */
    fun play(global: Int, continuous: Boolean, untilGlobal: Int = Int.MAX_VALUE) {
        this.continuous = continuous
        stopAtGlobal = untilGlobal
        playingGlobal.value = global
        buffering.value = true
        player.play(Reciters.selected(getApplication()).ayahUrl(getApplication(), global))
    }

    private fun onTrackFinished(completed: Boolean) {
        val current = playingGlobal.value ?: -1
        if (!completed) {
            stop()
            audioError.value = System.currentTimeMillis()
            return
        }
        if (continuous && current in 1 until 6236 && current < stopAtGlobal) {
            play(current + 1, continuous = true, untilGlobal = stopAtGlobal)
        } else {
            stop()
        }
    }

    fun stop() {
        continuous = false
        player.stop()
        buffering.value = false
        playingGlobal.value = -1
    }

    override fun onCleared() {
        player.stop()
    }
}

class QuranPagerActivity : AppCompatActivity() {

    private lateinit var binding: ActivityQuranPagerBinding
    private val viewModel: QuranViewModel by viewModels()
    private lateinit var adapter: PageAdapter
    private var sheetJob: Job? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityQuranPagerBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val prefs = Prefs.get(this)
        adapter = PageAdapter(prefs.getFloat(Prefs.KEY_QURAN_FONT, 24f)) { ayah -> showAyahSheet(ayah) }
        binding.pager.adapter = adapter
        binding.pager.offscreenPageLimit = 1

        val startPage = intent.getIntExtra(EXTRA_PAGE, 0).takeIf { it in 1..QuranData.PAGE_COUNT }
            ?: prefs.getInt(Prefs.KEY_LAST_PAGE, 1)
        if (savedInstanceState == null) {
            adapter.selectedGlobal = intent.getIntExtra(EXTRA_HIGHLIGHT_GLOBAL, -1)
            binding.pager.setCurrentItem(startPage - 1, false)
        }
        binding.pager.registerOnPageChangeCallback(object : ViewPager2.OnPageChangeCallback() {
            override fun onPageSelected(position: Int) {
                updateTitle(position + 1)
                Prefs.get(this@QuranPagerActivity).edit().putInt(Prefs.KEY_LAST_PAGE, position + 1).apply()
            }
        })
        updateTitle(binding.pager.currentItem + 1)
        updateReciterButton()

        binding.btnBack.setOnClickListener { finish() }
        binding.btnIndex.setOnClickListener {
            startActivity(MainActivity.intent(this, MainActivity.TAB_QURAN))
            finish()
        }
        binding.btnReciter.setOnClickListener { chooseReciter { updateReciterButton() } }
        binding.btnFontSmaller.setOnClickListener { changeFont(-2f) }
        binding.btnFontBigger.setOnClickListener { changeFont(2f) }
        binding.btnPlayPage.setOnClickListener {
            val page = QuranData.page(this, binding.pager.currentItem + 1)
            if (page.isNotEmpty()) viewModel.play(page.first().global, continuous = true)
        }
        binding.btnStop.setOnClickListener { viewModel.stop() }

        viewModel.playingGlobal.observe(this) { global -> onPlayingChanged(global) }
        viewModel.buffering.observe(this) { binding.progressAudio.visibility = if (it) View.VISIBLE else View.GONE }
        viewModel.audioError.observe(this) {
            Toast.makeText(this, R.string.quran_audio_error, Toast.LENGTH_SHORT).show()
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        val page = intent.getIntExtra(EXTRA_PAGE, 0)
        if (page in 1..QuranData.PAGE_COUNT) {
            val highlight = intent.getIntExtra(EXTRA_HIGHLIGHT_GLOBAL, -1)
            setSelected(highlight)
            binding.pager.setCurrentItem(page - 1, false)
        }
    }

    override fun onDestroy() {
        if (isFinishing) viewModel.stop()
        super.onDestroy()
    }

    private fun updateTitle(page: Int) {
        val ayahs = QuranData.page(this, page)
        if (ayahs.isEmpty()) return
        val surahs = ayahs.map { it.surah }.distinct().joinToString(" · ") { QuranData.surahName(this, it) }
        binding.textPageTitle.text = getString(R.string.quran_page_title, surahs, QuranData.toArabicDigits(ayahs.first().juz))
    }

    private fun updateReciterButton() {
        binding.btnReciter.text = Reciters.selected(this).name
    }

    private fun changeFont(delta: Float) {
        val size = (adapter.fontSp + delta).coerceIn(16f, 44f)
        Prefs.get(this).edit().putFloat(Prefs.KEY_QURAN_FONT, size).apply()
        adapter.fontSp = size
        @Suppress("NotifyDataSetChanged")
        adapter.notifyDataSetChanged()
    }

    private fun setSelected(global: Int) {
        val old = adapter.selectedGlobal
        adapter.selectedGlobal = global
        refreshGlobal(old)
        refreshGlobal(global)
    }

    private fun refreshGlobal(global: Int) {
        if (global <= 0) return
        val ayah = QuranData.byGlobal(this, global) ?: return
        adapter.notifyItemChanged(ayah.page - 1)
    }

    private fun onPlayingChanged(global: Int) {
        val old = adapter.playingGlobal
        adapter.playingGlobal = global
        refreshGlobal(old)
        if (global <= 0) {
            binding.playerBar.visibility = View.GONE
            return
        }
        val ayah = QuranData.byGlobal(this, global) ?: return
        refreshGlobal(global)
        if (binding.pager.currentItem != ayah.page - 1) binding.pager.setCurrentItem(ayah.page - 1, true)
        binding.playerBar.visibility = View.VISIBLE
        binding.textNowPlaying.text = getString(
            R.string.quran_now_playing, QuranData.surahName(this, ayah.surah),
            QuranData.toArabicDigits(ayah.ayah), Reciters.selected(this).name
        )
    }

    private fun chooseReciter(onChosen: () -> Unit) {
        val current = Reciters.selected(this)
        AlertDialog.Builder(this)
            .setTitle(R.string.quran_choose_reciter)
            .setSingleChoiceItems(Reciters.ALL.map { it.name }.toTypedArray(), Reciters.ALL.indexOf(current)) { dialog, which ->
                Prefs.get(this).edit().putString(Prefs.KEY_RECITER, Reciters.ALL[which].id).apply()
                dialog.dismiss()
                onChosen()
                // Restart the current recitation with the new reciter.
                val playing = viewModel.playingGlobal.value ?: -1
                if (playing > 0) viewModel.play(playing, continuous = true)
            }
            .show()
    }

    // ---- Ayah sheet: tafsir, recitation, bookmark, share ----

    private fun showAyahSheet(ayah: QAyah) {
        setSelected(ayah.global)
        val sheet = BottomSheetDialog(this)
        val b = SheetAyahBinding.inflate(layoutInflater)
        sheet.setContentView(b.root)
        val surahName = QuranData.surahName(this, ayah.surah)
        b.textSheetTitle.text = getString(R.string.quran_sheet_title, surahName, QuranData.toArabicDigits(ayah.ayah))
        b.textSheetAyah.text = ayah.text
        b.btnSheetReciter.text = getString(R.string.quran_reciter, Reciters.selected(this).name)
        b.btnSheetReciter.setOnClickListener {
            chooseReciter {
                b.btnSheetReciter.text = getString(R.string.quran_reciter, Reciters.selected(this).name)
                updateReciterButton()
            }
        }
        b.btnSheetPlay.setOnClickListener { viewModel.play(ayah.global, continuous = false) }
        b.btnSheetPlayFrom.setOnClickListener {
            viewModel.play(ayah.global, continuous = true)
            sheet.dismiss()
        }
        b.btnSheetBookmark.setOnClickListener {
            Prefs.get(this).edit().putInt(Prefs.KEY_BOOKMARK_GLOBAL, ayah.global).apply()
            Toast.makeText(this, getString(R.string.quran_bookmark_saved, ayah.ayah), Toast.LENGTH_SHORT).show()
        }
        b.btnSheetShare.setOnClickListener {
            val text = "${ayah.text}\n[$surahName: ${ayah.ayah}]"
            startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text), null))
        }
        b.btnSheetTafsirName.setOnClickListener {
            val current = Tafasir.selected(this)
            AlertDialog.Builder(this)
                .setTitle(R.string.quran_choose_tafsir)
                .setSingleChoiceItems(Tafasir.ALL.map { it.second }.toTypedArray(), Tafasir.ALL.indexOf(current)) { dialog, which ->
                    Prefs.get(this).edit().putString(Prefs.KEY_TAFSIR, Tafasir.ALL[which].first).apply()
                    dialog.dismiss()
                    loadTafsir(b, ayah)
                }
                .show()
        }
        loadTafsir(b, ayah)
        sheet.setOnDismissListener {
            sheetJob?.cancel()
            setSelected(-1)
        }
        sheet.show()
    }

    private fun loadTafsir(b: SheetAyahBinding, ayah: QAyah) {
        val (edition, name) = Tafasir.selected(this)
        b.btnSheetTafsirName.text = getString(R.string.quran_tafsir_header, name)
        b.textSheetTafsir.text = getString(R.string.quran_loading)
        sheetJob?.cancel()
        sheetJob = lifecycleScope.launch {
            val text = try {
                QuranApi.fetchTafsir(this@QuranPagerActivity, ayah.surah, edition)[ayah.ayah]
                    ?: getString(R.string.quran_tafsir_unavailable)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                getString(R.string.quran_tafsir_error)
            }
            b.textSheetTafsir.text = text
        }
    }

    // ---- Pages ----

    inner class PageAdapter(
        var fontSp: Float,
        private val onAyahClick: (QAyah) -> Unit
    ) : RecyclerView.Adapter<PageAdapter.ViewHolder>() {
        var playingGlobal = -1
        var selectedGlobal = -1

        inner class ViewHolder(val binding: ItemQuranPageBinding) : RecyclerView.ViewHolder(binding.root) {
            init {
                binding.textPageText.movementMethod = LinkMovementMethod.getInstance()
                // The Uthmani marks only render correctly in the Quran font; set it explicitly so no theme font wins.
                androidx.core.content.res.ResourcesCompat.getFont(binding.root.context, R.font.kfgqpc_hafs)?.let {
                    binding.textPageText.typeface = it
                }
                // tanzil.net justifies its text, but Android's inter-word justification cuts the last word of some
                // RTL lines off (verified on the emulator), so lines are right-aligned instead: no letter may be lost.
            }
        }

        override fun getItemCount() = QuranData.PAGE_COUNT

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
            ViewHolder(ItemQuranPageBinding.inflate(LayoutInflater.from(parent.context), parent, false))

        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val page = position + 1
            holder.binding.textPageText.setTextSize(TypedValue.COMPLEX_UNIT_SP, fontSp)
            holder.binding.textPageText.text = buildPage(page)
            holder.binding.textPageNumber.text = getString(R.string.quran_page_number, QuranData.toArabicDigits(page))
        }

        private fun buildPage(page: Int): CharSequence {
            val context = this@QuranPagerActivity
            val gold = ContextCompat.getColor(context, R.color.gold)
            val accent = ContextCompat.getColor(context, R.color.accent_text)
            val highlight = ContextCompat.getColor(context, R.color.ayah_highlight)
            val ayahNumber = ContextCompat.getColor(context, R.color.ayah_number)
            val sb = SpannableStringBuilder()
            for (ayah in QuranData.page(context, page)) {
                if (ayah.ayah == 1) {
                    if (sb.isNotEmpty() && sb.last() != '\n') sb.append('\n')
                    val headerStart = sb.length
                    sb.append("۞ ").append(QuranData.surahName(context, ayah.surah)).append(" ۞\n")
                    sb.setSpan(AlignmentSpan.Standard(Layout.Alignment.ALIGN_CENTER), headerStart, sb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                    sb.setSpan(ForegroundColorSpan(gold), headerStart, sb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                    sb.setSpan(StyleSpan(Typeface.BOLD), headerStart, sb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                    sb.setSpan(RelativeSizeSpan(1.05f), headerStart, sb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                    QuranData.surahBasmala(context, ayah.surah)?.let { basmala ->
                        val basmalaStart = sb.length
                        sb.append(basmala).append('\n')
                        sb.setSpan(AlignmentSpan.Standard(Layout.Alignment.ALIGN_CENTER), basmalaStart, sb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                        sb.setSpan(ForegroundColorSpan(accent), basmalaStart, sb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                    }
                }
                val start = sb.length
                // Exactly as tanzil.net writes it: the ayah, then "‎﴿number﴾‏" in green at 90% size (non-breaking, so
                // the number never starts a line on its own).
                sb.append(ayah.text).append('\u00A0')
                val markerStart = sb.length
                sb.append("\u200E\uFD3F").append(QuranData.toArabicDigits(ayah.ayah)).append("\uFD3E\u200F")
                val markerEnd = sb.length
                sb.append(' ')
                val end = sb.length
                sb.setSpan(object : ClickableSpan() {
                    override fun onClick(widget: View) = onAyahClick(ayah)
                    override fun updateDrawState(ds: TextPaint) {
                        ds.isUnderlineText = false
                    }
                }, start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                sb.setSpan(ForegroundColorSpan(ayahNumber), markerStart, markerEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                sb.setSpan(RelativeSizeSpan(0.9f), markerStart, markerEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                if (ayah.global == playingGlobal || ayah.global == selectedGlobal) {
                    sb.setSpan(BackgroundColorSpan(highlight), start, end - 1, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                }
            }
            return sb
        }
    }

    companion object {
        const val EXTRA_PAGE = "page"
        const val EXTRA_HIGHLIGHT_GLOBAL = "highlight_global"
    }
}

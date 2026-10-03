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
    /** Memorisation plan: the ayahs to recite in order (each already repeated), looped [planLoops] times (0 = forever). */
    private var plan: List<Int>? = null
    private var planIndex = 0
    private var planLoops = 1
    private var planLoop = 0
    /** Sleep timer: recitation stops at the end of the ayah playing at this time. */
    val sleepAt = MutableLiveData(0L)

    private val player = AudioPlayer(
        context = app,
        onStarted = { buffering.value = false },
        onFinished = { completed -> onTrackFinished(completed) }
    )

    /** Plays [global]; when [continuous], keeps going (optionally only up to [untilGlobal]). */
    fun play(global: Int, continuous: Boolean, untilGlobal: Int = Int.MAX_VALUE) {
        plan = null
        start(global, continuous, untilGlobal)
    }

    /** Recites [from]..[to] (global numbers), each ayah [eachTimes] times, the whole range [loops] times (0 = endless). */
    fun playRepeat(from: Int, to: Int, eachTimes: Int, loops: Int) {
        plan = (from..to).flatMap { g -> List(eachTimes) { g } }
        planIndex = 0
        planLoops = loops
        planLoop = 0
        start(plan!!.first(), continuous = false)
    }

    fun setSleepTimer(minutes: Int) {
        sleepAt.value = if (minutes > 0) System.currentTimeMillis() + minutes * 60_000L else 0L
    }

    private fun start(global: Int, continuous: Boolean, untilGlobal: Int = Int.MAX_VALUE) {
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
        val sleep = sleepAt.value ?: 0L
        if (sleep > 0 && System.currentTimeMillis() >= sleep) {
            sleepAt.value = 0L
            stop()
            return
        }
        val steps = plan
        if (steps != null) {
            planIndex++
            if (planIndex >= steps.size) {
                planLoop++
                if (planLoops != 0 && planLoop >= planLoops) return stop()
                planIndex = 0
            }
            start(steps[planIndex], continuous = false)
            return
        }
        if (continuous && current in 1 until 6236 && current < stopAtGlobal) {
            start(current + 1, continuous = true, untilGlobal = stopAtGlobal)
        } else {
            stop()
        }
    }

    /** Where a memorisation plan stands: (repetition of the current ayah, loop of the range), 1-based. */
    fun planProgress(): Pair<Int, Int>? {
        val steps = plan ?: return null
        val g = steps.getOrNull(planIndex) ?: return null
        val rep = (planIndex downTo 0).takeWhile { steps[it] == g }.count()
        return rep to planLoop + 1
    }

    fun stop() {
        plan = null
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
    /** The "Mushaf pages need the internet once" notice is shown once per visit. */
    private var fontErrorShown = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityQuranPagerBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val prefs = Prefs.get(this)
        adapter = PageAdapter(prefs.getFloat(Prefs.KEY_QURAN_FONT, 24f)) { ayah -> onAyahTapped(ayah) }
        binding.pager.adapter = adapter
        binding.pager.offscreenPageLimit = 1
        // The page fits the room the pager has; re-measure whenever that changes (e.g. the keyboard of the previous
        // screen closing after the Mushaf opened from a search), so the page is never squeezed.
        binding.pager.addOnLayoutChangeListener { v, _, top, _, bottom, _, oldTop, _, oldBottom ->
            if (bottom - top == oldBottom - oldTop || bottom - top <= 0) return@addOnLayoutChangeListener
            // page frame margins/padding and the page-number line
            val chrome = (10 * 2 + 12 + 8 + 40) * resources.displayMetrics.density
            MushafPageView.maxPageHeight = (bottom - top - chrome).toInt()
            v.post {
                @Suppress("NotifyDataSetChanged")
                adapter.notifyDataSetChanged()
            }
        }

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
        binding.btnReadingMode.setOnClickListener { chooseReadingMode() }
        val textMode = !MushafMode.isOn(this)
        binding.btnFontSmaller.visibility = if (textMode) View.VISIBLE else View.GONE
        binding.btnFontBigger.visibility = if (textMode) View.VISIBLE else View.GONE
        applyReadingMode()
        binding.btnPlayPage.setOnClickListener {
            val page = QuranData.page(this, binding.pager.currentItem + 1)
            if (page.isNotEmpty()) viewModel.play(page.first().global, continuous = true)
        }
        binding.btnStop.setOnClickListener { viewModel.stop() }
        binding.btnSleep.setOnClickListener { chooseSleepTimer() }
        binding.btnHide.setOnClickListener { toggleHide() }
        updateHideButton()

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

    // ---- Memorisation: hide the ayahs and reveal them one by one; repeat an ayah or a range ----

    private fun toggleHide() {
        adapter.hideMode = !adapter.hideMode
        adapter.revealed.clear()
        updateHideButton()
        if (adapter.hideMode) Toast.makeText(this, R.string.memorize_hide_hint, Toast.LENGTH_LONG).show()
        @Suppress("NotifyDataSetChanged")
        adapter.notifyDataSetChanged()
    }

    private fun updateHideButton() {
        binding.btnHide.setIconResource(if (adapter.hideMode) R.drawable.ic_visibility else R.drawable.ic_visibility_off)
        binding.btnHide.contentDescription = getString(if (adapter.hideMode) R.string.memorize_show else R.string.memorize_hide)
    }

    /** Tap on an ayah: while memorising, the first tap reveals it; otherwise (or once revealed) opens its sheet. */
    private fun onAyahTapped(ayah: QAyah) {
        if (adapter.hideMode && ayah.global !in adapter.revealed) {
            adapter.revealed.add(ayah.global)
            adapter.notifyItemChanged(ayah.page - 1)
        } else showAyahSheet(ayah)
    }

    private fun showRepeatDialog(ayah: QAyah) {
        val count = QuranData.ensureLoaded(this).count { it.surah == ayah.surah }
        val ends = (ayah.ayah..count).toList()
        val eachOptions = intArrayOf(1, 2, 3, 5, 7, 10, 15, 20)
        val loopOptions = intArrayOf(1, 2, 3, 5, 10, 0)
        val pad = (16 * resources.displayMetrics.density).toInt()
        val box = android.widget.LinearLayout(this).apply {
            orientation = android.widget.LinearLayout.HORIZONTAL
            setPadding(pad, pad, pad, 0)
        }
        fun column(label: Int, values: List<String>, initial: Int): android.widget.NumberPicker {
            val col = android.widget.LinearLayout(this).apply {
                orientation = android.widget.LinearLayout.VERTICAL
                gravity = android.view.Gravity.CENTER_HORIZONTAL
            }
            col.addView(android.widget.TextView(this).apply {
                setText(label)
                gravity = android.view.Gravity.CENTER
                setTextAppearance(R.style.Text_LabelMedium)
            })
            val picker = android.widget.NumberPicker(this).apply {
                minValue = 0
                maxValue = values.size - 1
                displayedValues = values.toTypedArray()
                value = initial
                wrapSelectorWheel = false
            }
            col.addView(picker)
            box.addView(col, android.widget.LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
            return picker
        }
        val toPicker = column(R.string.memorize_to_ayah, ends.map { QuranData.toArabicDigits(it) }, 0)
        val eachPicker = column(R.string.memorize_each, eachOptions.map { QuranData.toArabicDigits(it) }, 2)
        val loopPicker = column(R.string.memorize_loops, loopOptions.map {
            if (it == 0) getString(R.string.memorize_forever) else QuranData.toArabicDigits(it)
        }, 0)
        AlertDialog.Builder(this)
            .setTitle(QuranData.styledName(this, getString(R.string.memorize_repeat_title,
                QuranData.surahName(this, ayah.surah), QuranData.toArabicDigits(ayah.ayah)), ayah.surah))
            .setView(box)
            .setPositiveButton(R.string.memorize_start) { _, _ ->
                val to = ayah.global + (ends[toPicker.value] - ayah.ayah)
                viewModel.playRepeat(ayah.global, to, eachOptions[eachPicker.value], loopOptions[loopPicker.value])
            }
            .setNegativeButton(android.R.string.cancel, null)
            .show()
    }

    private fun chooseSleepTimer() {
        val minutes = intArrayOf(0, 5, 10, 15, 30, 45, 60)
        val labels = minutes.map {
            if (it == 0) getString(R.string.sleep_off) else getString(R.string.sleep_minutes, arabicMinutes(it))
        }.toTypedArray()
        AlertDialog.Builder(this)
            .setTitle(R.string.sleep_timer)
            .setItems(labels) { _, which ->
                viewModel.setSleepTimer(minutes[which])
                if (minutes[which] > 0) Toast.makeText(this, getString(R.string.sleep_set, arabicMinutes(minutes[which])), Toast.LENGTH_SHORT).show()
            }
            .show()
    }

    private fun updateTitle(page: Int) {
        val ayahs = QuranData.page(this, page)
        if (ayahs.isEmpty()) return
        val surahs = ayahs.map { it.surah }.distinct().joinToString(" · ") { QuranData.surahName(this, it) }
        binding.textPageTitle.text = QuranData.styledName(
            this, getString(R.string.quran_page_title, surahs, QuranData.toArabicDigits(ayahs.first().juz)),
            *ayahs.map { it.surah }.distinct().toIntArray()
        )
    }

    private fun updateReciterButton() {
        binding.btnReciter.text = Reciters.selected(this).name
    }

    private fun chooseReadingMode() {
        val modes = ReadingMode.values()
        androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle(R.string.settings_reading_mode)
            .setSingleChoiceItems(modes.map { getString(it.labelRes) }.toTypedArray(), ReadingMode.get(this).ordinal) { d, which ->
                ReadingMode.set(this, modes[which])
                applyReadingMode()
                d.dismiss()
            }
            .show()
    }

    private fun applyReadingMode() {
        val c = ReadingMode.get(this).colors(this)
        binding.pagerRoot.setBackgroundColor(c.background)
        binding.btnReadingMode.setIconResource(if (c.isDark) R.drawable.ic_sun else R.drawable.ic_moon)
        adapter.colors = c
        adapter.notifyDataSetChanged()
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
        val progress = viewModel.planProgress()?.let { (rep, loop) ->
            "\n" + getString(R.string.memorize_progress, QuranData.toArabicDigits(rep), QuranData.toArabicDigits(loop))
        } ?: ""
        binding.textNowPlaying.text = QuranData.styledName(this, getString(
            R.string.quran_now_playing, QuranData.surahName(this, ayah.surah),
            QuranData.toArabicDigits(ayah.ayah), Reciters.selected(this).name
        ) + progress, ayah.surah)
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
        b.textSheetTitle.text = QuranData.styledName(this, getString(R.string.quran_sheet_title, surahName, QuranData.toArabicDigits(ayah.ayah)), ayah.surah)
        b.textSheetAyah.text = ayah.text
        Ui.quranLines(b.textSheetAyah)
        b.textSheetTafsir.setTextSize(TypedValue.COMPLEX_UNIT_SP, b.textSheetTafsir.textSize / resources.displayMetrics.scaledDensity * Prefs.textScale(this))
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
        b.btnSheetRepeat.setOnClickListener {
            sheet.dismiss()
            showRepeatDialog(ayah)
        }
        b.btnSheetImage.setOnClickListener { ShareImage.ayah(this, ayah) }
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
        /** Memorisation: ayahs are hidden (only their first word shows) until tapped. */
        var hideMode = false
        val revealed = HashSet<Int>()
        var colors: ReadingMode.Colors? = null

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
            Ui.quranLines(holder.binding.textPageText, 2.15f)
            colors?.let { c ->
                (holder.binding.pageFrame.background.mutate() as? android.graphics.drawable.GradientDrawable)?.setColor(c.paper)
                holder.binding.textPageText.setTextColor(c.text)
                holder.binding.textPageNumber.setTextColor(c.pageNumber)
            }
            holder.binding.textPageNumber.text = getString(R.string.quran_page_number, QuranData.toArabicDigits(page))
            bindMushaf(holder, page, position)
        }

        /**
         * Madinah Mushaf view when its page font is available; while it downloads (or if it cannot be fetched
         * offline) the same page is shown as Tanzil text, so reading never waits on the network.
         */
        private fun bindMushaf(holder: ViewHolder, page: Int, position: Int) {
            val b = holder.binding
            val context = this@QuranPagerActivity
            val lines = if (MushafMode.isOn(context)) runCatching { MushafLayout.page(context, page) }.getOrDefault(emptyList()) else emptyList()
            val font = if (lines.isNotEmpty()) MushafFonts.cached(context, page) else null
            if (font == null) {
                b.mushafPage.visibility = View.GONE
                b.textPageText.visibility = View.VISIBLE
                b.textPageText.text = buildPage(page)
                if (lines.isNotEmpty()) {
                    b.progressMushaf.visibility = View.VISIBLE
                    lifecycleScope.launch {
                        val ok = runCatching { MushafFonts.get(context, page) }.isSuccess
                        b.progressMushaf.visibility = View.GONE
                        if (!ok && !fontErrorShown) {
                            fontErrorShown = true
                            Toast.makeText(context, R.string.mushaf_font_offline, Toast.LENGTH_LONG).show()
                        }
                        // get() can return without suspending (font already on disk), i.e. while RecyclerView is
                        // still binding: refresh on the next frame, never in the middle of a layout pass.
                        if (ok) b.root.post { if (position in 0 until itemCount) notifyItemChanged(position) }
                    }
                } else b.progressMushaf.visibility = View.GONE
                return
            }
            b.progressMushaf.visibility = View.GONE
            b.textPageText.visibility = View.GONE
            b.mushafPage.visibility = View.VISIBLE
            val c = colors ?: ReadingMode.get(context).colors(context)
            b.mushafPage.textColor = c.text
            b.mushafPage.accentColor = c.pageNumber
            b.mushafPage.goldColor = Themes.color(context, R.color.gold)
            b.mushafPage.highlightColor = Themes.color(context, R.color.ayah_highlight)
            b.mushafPage.bind(page, lines, font)
            b.mushafPage.highlighted = listOf(selectedGlobal, playingGlobal).filter { it > 0 }
                .mapNotNull { QuranData.byGlobal(context, it) }.map { it.surah to it.ayah }.toSet()
            b.mushafPage.maskColor = Themes.color(context, R.color.memorize_mask)
            b.mushafPage.isHidden = if (!hideMode) null else { s, a ->
                QuranData.ensureLoaded(context).firstOrNull { it.surah == s && it.ayah == a }?.global !in revealed
            }
            b.mushafPage.onWordClick = { surah, ayah ->
                QuranData.ensureLoaded(context).firstOrNull { it.surah == surah && it.ayah == ayah }?.let(onAyahClick)
            }
        }

        private fun buildPage(page: Int): CharSequence {
            val context = this@QuranPagerActivity
            val gold = Themes.color(context, R.color.gold)
            val accent = colors?.pageNumber ?: Themes.color(context, R.color.accent_text)
            val highlight = Themes.color(context, R.color.ayah_highlight)
            val ayahNumber = colors?.ayahNumber ?: Themes.color(context, R.color.ayah_number)
            val sb = SpannableStringBuilder()
            for (ayah in QuranData.page(context, page)) {
                if (ayah.ayah == 1) {
                    if (sb.isNotEmpty() && sb.last() != '\n') sb.append('\n')
                    val headerStart = sb.length
                    sb.append("۞ ").append(QuranData.arabicSurahName(context, ayah.surah)).append(" ۞\n")
                    sb.setSpan(AlignmentSpan.Standard(Layout.Alignment.ALIGN_CENTER), headerStart, sb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                    sb.setSpan(ForegroundColorSpan(gold), headerStart, sb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
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
                sb.append("\u200E\uFD3F").append(QuranData.quranDigits(ayah.ayah)).append("\uFD3E\u200F")
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
                if (hideMode && ayah.global !in revealed) {
                    // Hide all but the first word (a cue), keeping the line shapes: the letters are drawn in the
                    // page colour over a soft bar, so the text itself is untouched.
                    val firstSpace = ayah.text.indexOf(' ').let { if (it < 0) ayah.text.length else it }
                    val hideStart = start + firstSpace
                    val hideEnd = start + ayah.text.length
                    if (hideEnd > hideStart) {
                        sb.setSpan(ForegroundColorSpan(android.graphics.Color.TRANSPARENT), hideStart, hideEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                        sb.setSpan(BackgroundColorSpan(Themes.color(context, R.color.memorize_mask)), hideStart, hideEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                    }
                }
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

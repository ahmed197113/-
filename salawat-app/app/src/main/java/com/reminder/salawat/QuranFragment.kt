package com.reminder.salawat

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.widget.doAfterTextChanged
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.reminder.salawat.databinding.FragmentQuranBinding
import com.reminder.salawat.databinding.HeaderQuranBinding
import com.reminder.salawat.databinding.ItemSurahBinding

/** Quran index: continue reading, bookmark, surah list and juz list — everything opens the Mushaf pages. */
class QuranFragment : Fragment(R.layout.fragment_quran) {

    private var _binding: FragmentQuranBinding? = null
    private val binding get() = _binding!!
    private lateinit var adapter: IndexAdapter
    private var showJuz = false
    private var query = ""

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        _binding = FragmentQuranBinding.bind(view)
        adapter = IndexAdapter()
        binding.recyclerQuran.layoutManager = LinearLayoutManager(view.context)
        binding.recyclerQuran.adapter = adapter
        binding.editSearch.doAfterTextChanged {
            query = SurahIndex.normalize(it?.toString().orEmpty().trim())
            if (query.isNotEmpty()) showJuz = false
            adapter.reload()
        }
        adapter.reload()
    }

    override fun onResume() {
        super.onResume()
        if (_binding != null) adapter.notifyItemChanged(0)
    }

    override fun onHiddenChanged(hidden: Boolean) {
        super.onHiddenChanged(hidden)
        if (!hidden && _binding != null) adapter.notifyItemChanged(0)
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    private fun openPage(page: Int, highlightGlobal: Int = -1) {
        startActivity(
            Intent(requireContext(), QuranPagerActivity::class.java)
                .putExtra(QuranPagerActivity.EXTRA_PAGE, page)
                .putExtra(QuranPagerActivity.EXTRA_HIGHLIGHT_GLOBAL, highlightGlobal)
        )
    }

    private sealed class Row {
        object Header : Row()
        data class Surah(val ref: SurahRef) : Row()
        data class Juz(val number: Int) : Row()
    }

    private inner class IndexAdapter : RecyclerView.Adapter<RecyclerView.ViewHolder>() {
        private var rows: List<Row> = listOf(Row.Header)

        @android.annotation.SuppressLint("NotifyDataSetChanged")
        fun reload() {
            val context = requireContext()
            val list = ArrayList<Row>()
            list.add(Row.Header)
            if (showJuz) {
                (1..30).forEach { list.add(Row.Juz(it)) }
            } else {
                QuranApi.loadSurahList(context)
                    .filter {
                        query.isEmpty() || it.number.toString() == query ||
                            SurahIndex.normalize(it.name).contains(query) || it.englishName.contains(query, ignoreCase = true)
                    }
                    .forEach { list.add(Row.Surah(it)) }
            }
            rows = list
            notifyDataSetChanged()
        }

        override fun getItemCount() = rows.size

        override fun getItemViewType(position: Int) = if (rows[position] is Row.Header) 0 else 1

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
            val inflater = LayoutInflater.from(parent.context)
            return if (viewType == 0) HeaderHolder(HeaderQuranBinding.inflate(inflater, parent, false))
            else ItemHolder(ItemSurahBinding.inflate(inflater, parent, false))
        }

        override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
            val context = holder.itemView.context
            when (val row = rows[position]) {
                is Row.Header -> bindHeader((holder as HeaderHolder).b, context)
                is Row.Surah -> {
                    val b = (holder as ItemHolder).b
                    val ref = row.ref
                    val page = QuranData.surahStartPage(context, ref.number)
                    b.textSurahNumber.text = QuranData.toArabicDigits(ref.number)
                    b.textSurahName.text = ref.name
                    val type = getString(if (ref.revelationType == "Meccan") R.string.meccan else R.string.medinan)
                    b.textSurahMeta.text = getString(R.string.quran_surah_meta, type, ref.numberOfAyahs)
                    b.textSurahPage.text = getString(R.string.quran_page_short, QuranData.toArabicDigits(page))
                    b.root.setOnClickListener { openPage(page) }
                }
                is Row.Juz -> {
                    val b = (holder as ItemHolder).b
                    val page = QuranData.juzStartPage(context, row.number)
                    val first = QuranData.page(context, page).firstOrNull()
                    b.textSurahNumber.text = QuranData.toArabicDigits(row.number)
                    b.textSurahName.text = getString(R.string.quran_juz, JUZ_NAMES[row.number - 1])
                    b.textSurahMeta.text = first?.let { Ui.quranNames(context, QuranData.surahName(context, it.surah), QuranData.surahName(context, it.surah)) } ?: ""
                    b.textSurahPage.text = getString(R.string.quran_page_short, QuranData.toArabicDigits(page))
                    b.root.setOnClickListener { openPage(page) }
                }
            }
        }

        private fun bindHeader(b: HeaderQuranBinding, context: Context) {
            val prefs = Prefs.get(context)
            val lastPage = prefs.getInt(Prefs.KEY_LAST_PAGE, 0)
            b.textContinue.text = if (lastPage > 0) {
                val surah = QuranData.page(context, lastPage).firstOrNull()?.surah ?: 1
                QuranData.styledName(context, getString(R.string.continue_reading_value, QuranData.surahName(context, surah), QuranData.toArabicDigits(lastPage)), surah)
            } else getString(R.string.quran_start_reading)
            b.cardContinue.setOnClickListener { openPage(if (lastPage > 0) lastPage else 1) }

            val bookmark = prefs.getInt(Prefs.KEY_BOOKMARK_GLOBAL, 0)
            val ayah = if (bookmark > 0) QuranData.byGlobal(context, bookmark) else null
            b.textBookmark.text = if (ayah != null) {
                QuranData.styledName(context, getString(R.string.quran_go_bookmark, QuranData.surahName(context, ayah.surah), QuranData.toArabicDigits(ayah.ayah)), ayah.surah)
            } else getString(R.string.quran_no_bookmark)
            b.cardBookmark.isEnabled = ayah != null
            b.cardBookmark.setOnClickListener { ayah?.let { openPage(it.page, it.global) } }

            bindKhatma(b, context)
            b.btnQuranSearch.setOnClickListener { startActivity(Intent(context, QuranSearchActivity::class.java)) }

            b.toggleList.clearOnButtonCheckedListeners()
            b.toggleList.check(if (showJuz) R.id.btnListJuz else R.id.btnListSurahs)
            b.toggleList.addOnButtonCheckedListener { _, id, checked ->
                if (!checked) return@addOnButtonCheckedListener
                val juz = id == R.id.btnListJuz
                if (juz != showJuz) {
                    showJuz = juz
                    binding.recyclerQuran.post { reload() }
                }
            }
        }
    }

    private fun bindKhatma(b: HeaderQuranBinding, context: Context) {
        val status = Khatma.status(context)
        if (status == null) {
            b.textKhatmaTitle.setText(R.string.khatma_start)
            b.textKhatma.setText(R.string.khatma_start_desc)
            b.progressKhatma.visibility = View.GONE
            b.cardKhatma.setOnClickListener { chooseKhatmaDays() }
            return
        }
        b.textKhatmaTitle.text = "${getString(R.string.khatma_title)} — ${getString(R.string.khatma_progress, QuranData.toArabicDigits(status.percent))}"
        b.textKhatma.text = Khatma.todayText(context)
        b.progressKhatma.visibility = View.VISIBLE
        b.progressKhatma.setProgressCompat(status.percent, false)
        b.cardKhatma.setOnClickListener {
            androidx.appcompat.app.AlertDialog.Builder(context)
                .setTitle(R.string.khatma_title)
                .setMessage(Khatma.todayText(context))
                .setPositiveButton(R.string.khatma_read_today) { _, _ -> openPage(status.todayFrom.coerceAtLeast(status.currentPage.coerceAtMost(status.todayTo))) }
                .setNegativeButton(R.string.khatma_stop) { _, _ -> Khatma.stop(context); adapter.notifyItemChanged(0) }
                .show()
        }
    }

    private fun chooseKhatmaDays() {
        val context = requireContext()
        val options = intArrayOf(7, 10, 15, 20, 30, 40, 60)
        androidx.appcompat.app.AlertDialog.Builder(context)
            .setTitle(R.string.khatma_choose_days)
            .setItems(options.map { getString(R.string.khatma_days, QuranData.toArabicDigits(it)) }.toTypedArray()) { _, which ->
                Khatma.start(context, options[which])
                Reminders.setOn(context, ReminderType.WIRD, true)
                adapter.notifyItemChanged(0)
            }
            .show()
    }

    private class HeaderHolder(val b: HeaderQuranBinding) : RecyclerView.ViewHolder(b.root)
    private class ItemHolder(val b: ItemSurahBinding) : RecyclerView.ViewHolder(b.root)

    companion object {
        private val JUZ_NAMES = listOf(
            "الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر",
            "الحادي عشر", "الثاني عشر", "الثالث عشر", "الرابع عشر", "الخامس عشر", "السادس عشر", "السابع عشر",
            "الثامن عشر", "التاسع عشر", "العشرون", "الحادي والعشرون", "الثاني والعشرون", "الثالث والعشرون",
            "الرابع والعشرون", "الخامس والعشرون", "السادس والعشرون", "السابع والعشرون", "الثامن والعشرون",
            "التاسع والعشرون", "الثلاثون"
        )
    }
}

object SurahIndex {
    private val DIACRITICS = Regex("[ً-ٰٟۖ-ۭـ]")

    /** Strips tashkeel and unifies alef/taa forms so "البقرة" matches "سُورَةُ البَقَرَةِ". */
    fun normalize(text: String): String =
        text.replace(DIACRITICS, "")
            .replace('أ', 'ا').replace('إ', 'ا').replace('آ', 'ا').replace('ٱ', 'ا')
            .replace('ة', 'ه').replace('ى', 'ي')
}

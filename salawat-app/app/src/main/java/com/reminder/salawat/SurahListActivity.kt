package com.reminder.salawat

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.widget.doAfterTextChanged
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.reminder.salawat.databinding.ActivitySurahListBinding
import com.reminder.salawat.databinding.ItemSurahBinding

/** Quran index: surahs, juz list, bookmark and "continue reading"; everything opens the page view. */
class SurahListActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySurahListBinding
    private lateinit var all: List<SurahRef>
    private lateinit var adapter: SurahAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySurahListBinding.inflate(layoutInflater)
        setContentView(binding.root)
        all = QuranApi.loadSurahList(this)
        adapter = SurahAdapter { openPage(QuranData.surahStartPage(this, it.number)) }
        binding.recyclerSurahs.layoutManager = LinearLayoutManager(this)
        binding.recyclerSurahs.adapter = adapter
        adapter.submit(all)
        binding.editSearch.doAfterTextChanged { filter(it?.toString().orEmpty()) }
        binding.btnJuz.setOnClickListener { showJuzList() }
    }

    override fun onResume() {
        super.onResume()
        val prefs = Prefs.get(this)
        val lastPage = prefs.getInt(Prefs.KEY_LAST_PAGE, 0)
        if (lastPage > 0) {
            binding.btnContinue.text = getString(R.string.quran_continue_page, QuranData.toArabicDigits(lastPage))
            binding.btnContinue.visibility = View.VISIBLE
            binding.btnContinue.setOnClickListener { openPage(lastPage) }
        } else {
            binding.btnContinue.visibility = View.GONE
        }
        val bookmark = prefs.getInt(Prefs.KEY_BOOKMARK_GLOBAL, 0)
        val ayah = if (bookmark > 0) QuranData.byGlobal(this, bookmark) else null
        if (ayah != null) {
            binding.btnBookmark.text = getString(
                R.string.quran_go_bookmark, QuranData.surahName(this, ayah.surah), QuranData.toArabicDigits(ayah.ayah)
            )
            binding.btnBookmark.visibility = View.VISIBLE
            binding.btnBookmark.setOnClickListener { openPage(ayah.page, ayah.global) }
        } else {
            binding.btnBookmark.visibility = View.GONE
        }
    }

    private fun showJuzList() {
        val labels = (1..30).map { getString(R.string.quran_juz, QuranData.toArabicDigits(it)) }.toTypedArray()
        AlertDialog.Builder(this)
            .setTitle(R.string.quran_juz_list)
            .setItems(labels) { _, which -> openPage(QuranData.juzStartPage(this, which + 1)) }
            .show()
    }

    private fun filter(query: String) {
        val q = normalize(query.trim())
        if (q.isEmpty()) {
            adapter.submit(all)
            return
        }
        adapter.submit(all.filter {
            it.number.toString() == q || normalize(it.name).contains(q) || it.englishName.contains(q, ignoreCase = true)
        })
    }

    private fun openPage(page: Int, highlightGlobal: Int = -1) {
        startActivity(
            Intent(this, QuranPagerActivity::class.java)
                .putExtra(QuranPagerActivity.EXTRA_PAGE, page)
                .putExtra(QuranPagerActivity.EXTRA_HIGHLIGHT_GLOBAL, highlightGlobal)
                .addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
        )
    }

    inner class SurahAdapter(private val onClick: (SurahRef) -> Unit) : RecyclerView.Adapter<SurahAdapter.ViewHolder>() {
        private var items: List<SurahRef> = emptyList()

        @android.annotation.SuppressLint("NotifyDataSetChanged")
        fun submit(list: List<SurahRef>) {
            items = list
            notifyDataSetChanged()
        }

        inner class ViewHolder(val binding: ItemSurahBinding) : RecyclerView.ViewHolder(binding.root)

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
            ViewHolder(ItemSurahBinding.inflate(LayoutInflater.from(parent.context), parent, false))

        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val item = items[position]
            holder.binding.textSurahNumber.text = item.number.toString()
            holder.binding.textSurahName.text = item.name
            val type = getString(if (item.revelationType == "Meccan") R.string.meccan else R.string.medinan)
            holder.binding.textSurahMeta.text = getString(
                R.string.quran_surah_meta_page, type, item.numberOfAyahs, QuranData.surahStartPage(this@SurahListActivity, item.number)
            )
            holder.itemView.setOnClickListener { onClick(item) }
        }

        override fun getItemCount() = items.size
    }

    companion object {
        private val DIACRITICS = Regex("[ً-ٰٟۖ-ۭـ]")

        /** Strips tashkeel and unifies alef forms so "البقرة" matches "سُورَةُ البَقَرَةِ". */
        fun normalize(text: String): String =
            text.replace(DIACRITICS, "")
                .replace('أ', 'ا').replace('إ', 'ا').replace('آ', 'ا').replace('ٱ', 'ا')
                .replace('ة', 'ه').replace('ى', 'ي')
    }
}

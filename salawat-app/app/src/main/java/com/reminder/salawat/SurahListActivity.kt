package com.reminder.salawat

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.appcompat.app.AppCompatActivity
import androidx.core.widget.doAfterTextChanged
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.reminder.salawat.databinding.ActivitySurahListBinding
import com.reminder.salawat.databinding.ItemSurahBinding

class SurahListActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySurahListBinding
    private lateinit var all: List<SurahRef>
    private val adapter = SurahAdapter { openSurah(it.number, it.name, 0) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySurahListBinding.inflate(layoutInflater)
        setContentView(binding.root)
        all = QuranApi.loadSurahList(this)
        binding.recyclerSurahs.layoutManager = LinearLayoutManager(this)
        binding.recyclerSurahs.adapter = adapter
        adapter.submit(all)
        binding.editSearch.doAfterTextChanged { filter(it?.toString().orEmpty()) }
    }

    override fun onResume() {
        super.onResume()
        val prefs = Prefs.get(this)
        val surah = prefs.getInt(Prefs.KEY_LAST_SURAH, 0)
        if (surah > 0) {
            val ayah = prefs.getInt(Prefs.KEY_LAST_AYAH, 1)
            val name = prefs.getString(Prefs.KEY_LAST_SURAH_NAME, "").orEmpty()
            binding.btnContinue.text = getString(R.string.quran_continue, name, ayah)
            binding.btnContinue.visibility = View.VISIBLE
            binding.btnContinue.setOnClickListener { openSurah(surah, name, ayah) }
        } else {
            binding.btnContinue.visibility = View.GONE
        }
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

    private fun openSurah(number: Int, name: String, ayah: Int) {
        startActivity(
            Intent(this, SurahDetailActivity::class.java)
                .putExtra(SurahDetailActivity.EXTRA_SURAH_NUMBER, number)
                .putExtra(SurahDetailActivity.EXTRA_SURAH_NAME, name)
                .putExtra(SurahDetailActivity.EXTRA_AYAH, ayah)
        )
    }

    class SurahAdapter(private val onClick: (SurahRef) -> Unit) : RecyclerView.Adapter<SurahAdapter.ViewHolder>() {
        private var items: List<SurahRef> = emptyList()

        @android.annotation.SuppressLint("NotifyDataSetChanged")
        fun submit(list: List<SurahRef>) {
            items = list
            notifyDataSetChanged()
        }

        class ViewHolder(val binding: ItemSurahBinding) : RecyclerView.ViewHolder(binding.root)

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
            ViewHolder(ItemSurahBinding.inflate(LayoutInflater.from(parent.context), parent, false))

        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val item = items[position]
            val context = holder.itemView.context
            holder.binding.textSurahNumber.text = item.number.toString()
            holder.binding.textSurahName.text = item.name
            val type = context.getString(if (item.revelationType == "Meccan") R.string.meccan else R.string.medinan)
            holder.binding.textSurahMeta.text = context.getString(R.string.quran_surah_meta, type, item.numberOfAyahs)
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

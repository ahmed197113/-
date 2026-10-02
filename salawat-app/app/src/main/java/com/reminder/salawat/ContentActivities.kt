package com.reminder.salawat

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.widget.doAfterTextChanged
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.reminder.salawat.databinding.ActivityListBinding
import com.reminder.salawat.databinding.ViewSearchFieldBinding
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private fun ActivityListBinding.setup(activity: AppCompatActivity, titleRes: Int) {
    activity.setContentView(root)
    toolbar.toolbar.setTitle(titleRes)
    toolbar.toolbar.setNavigationOnClickListener { activity.finish() }
}

private fun ActivityListBinding.intro(text: String) {
    val tv = TextView(root.context, null, 0, R.style.Hint)
    tv.text = text
    tv.setPadding(8, 20, 8, 4)
    tv.textAlignment = View.TEXT_ALIGNMENT_CENTER
    header.addView(tv)
}

private fun AppCompatActivity.openMushaf(ayah: QAyah) {
    startActivity(
        Intent(this, QuranPagerActivity::class.java)
            .putExtra(QuranPagerActivity.EXTRA_PAGE, ayah.page)
            .putExtra(QuranPagerActivity.EXTRA_HIGHLIGHT_GLOBAL, ayah.global)
    )
}

class NamesActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val b = ActivityListBinding.inflate(layoutInflater)
        b.setup(this, R.string.tool_names)
        b.intro(getString(R.string.names_intro))
        val adapter = RowsAdapter()
        b.list.layoutManager = LinearLayoutManager(this)
        b.list.adapter = adapter
        adapter.submit(AllahNames.all(this).map {
            Row.Card(title = QuranData.toArabicDigits(it.number), body = it.name, meta = it.meaning, quranFont = true, bodySp = 30f)
        })
    }
}

class RuqyahActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val b = ActivityListBinding.inflate(layoutInflater)
        b.setup(this, R.string.tool_ruqyah)
        b.intro(getString(R.string.ruqyah_intro))
        val adapter = RowsAdapter()
        b.list.layoutManager = LinearLayoutManager(this)
        b.list.adapter = adapter
        adapter.submit(Ruqyah.PASSAGES.mapNotNull { p ->
            val ayahs = Ruqyah.ayahs(this, p)
            if (ayahs.isEmpty()) return@mapNotNull null
            val surah = QuranData.surahName(this, p.first)
            val title = if (p.second == p.third) getString(R.string.ruqyah_passage_one, surah, QuranData.toArabicDigits(p.second))
            else getString(R.string.ruqyah_passage, surah, QuranData.toArabicDigits(p.second), QuranData.toArabicDigits(p.third))
            Row.Card(
                title = title,
                body = ayahs.joinToString(" ") { "${it.text} ﴿${QuranData.toArabicDigits(it.ayah)}﴾" },
                quranFont = true,
                bodySp = 21f,
                action1 = getString(R.string.ruqyah_open) to { openMushaf(ayahs.first()) }
            )
        })
    }
}

class QuranSearchActivity : AppCompatActivity() {
    private var job: Job? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val b = ActivityListBinding.inflate(layoutInflater)
        b.setup(this, R.string.tool_search)
        val adapter = RowsAdapter()
        b.list.layoutManager = LinearLayoutManager(this)
        b.list.adapter = adapter
        val search = ViewSearchFieldBinding.inflate(LayoutInflater.from(this), b.header, true)
        search.editSearchField.setHint(R.string.search_hint)
        search.editSearchField.requestFocus()
        search.editSearchField.doAfterTextChanged { text ->
            job?.cancel()
            job = lifecycleScope.launch {
                delay(300)
                val query = text?.toString().orEmpty()
                b.progress.visibility = View.VISIBLE
                val results = QuranSearch.search(this@QuranSearchActivity, query)
                b.progress.visibility = View.GONE
                b.textEmpty.visibility = if (query.length >= 2 && results.isEmpty()) View.VISIBLE else View.GONE
                b.textEmpty.setText(R.string.search_empty)
                val rows = ArrayList<Row>()
                if (results.isNotEmpty()) rows.add(Row.Section(getString(R.string.search_results, QuranData.toArabicDigits(results.size))))
                results.forEach { a ->
                    rows.add(Row.Card(
                        title = getString(R.string.search_ref, QuranData.surahName(this@QuranSearchActivity, a.surah),
                            QuranData.toArabicDigits(a.ayah), QuranData.toArabicDigits(a.page)),
                        body = a.text, quranFont = true, bodySp = 21f,
                        onClick = { openMushaf(a) }
                    ))
                }
                adapter.submit(rows)
            }
        }
        intent.getStringExtra(EXTRA_QUERY)?.let { search.editSearchField.setText(unescape(it)) }
    }

    /** Accepts "\\uXXXX" escapes so tests can pass Arabic through adb. */
    private fun unescape(s: String) = Regex("\\\\u([0-9a-fA-F]{4})").replace(s) { it.groupValues[1].toInt(16).toChar().toString() }

    companion object {
        const val EXTRA_QUERY = "query"
    }
}


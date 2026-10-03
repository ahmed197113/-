package com.reminder.salawat

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.widget.doAfterTextChanged
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.reminder.salawat.databinding.ActivityListBinding
import com.reminder.salawat.databinding.ViewSearchFieldBinding
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** Library of hadith books; the big ones download once (≈0.2–1.4 MB each) and then work offline. */
class HadithBooksActivity : LocalizedActivity() {

    private lateinit var binding: ActivityListBinding
    private val adapter = RowsAdapter()
    private val progress = HashMap<String, Int>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityListBinding.inflate(layoutInflater)
        setContentView(binding.root)
        binding.toolbar.toolbar.setTitle(R.string.tool_hadith)
        binding.toolbar.toolbar.setNavigationOnClickListener { finish() }
        binding.list.layoutManager = LinearLayoutManager(this)
        binding.list.adapter = adapter
    }

    override fun onResume() {
        super.onResume()
        render()
    }

    private fun render() {
        adapter.submit(Hadiths.BOOKS.map { info ->
            val available = Hadiths.isAvailable(this, info)
            val status = when {
                progress.containsKey(info.id) -> getString(R.string.hadith_downloading, progress[info.id] ?: 0)
                info.bundled -> getString(R.string.hadith_bundled)
                available -> getString(R.string.hadith_downloaded)
                else -> getString(R.string.hadith_download, info.sizeMb)
            }
            Row.Card(
                title = info.title,
                body = getString(R.string.hadith_count, QuranData.toArabicDigits(info.count)) +
                    (if (info.author.isNotBlank()) " • ${info.author}" else "") + "\n✓ " + info.grading,
                meta = status,
                bodySp = 14f,
                action2 = if (available && !info.bundled) getString(R.string.hadith_delete) to {
                    Hadiths.delete(this, info)
                    render()
                } else null,
                onClick = { open(info) }
            )
        })
    }

    private fun open(info: HadithBookInfo) {
        if (Hadiths.isAvailable(this, info)) {
            startActivity(Intent(this, HadithReaderActivity::class.java).putExtra(HadithReaderActivity.EXTRA_BOOK, info.id))
            return
        }
        if (progress.containsKey(info.id)) return
        progress[info.id] = 0
        render()
        lifecycleScope.launch {
            try {
                Hadiths.download(this@HadithBooksActivity, info) { progress[info.id] = it; render() }
                progress.remove(info.id)
                render()
                open(info)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                progress.remove(info.id)
                render()
                Toast.makeText(this@HadithBooksActivity, R.string.hadith_download_failed, Toast.LENGTH_SHORT).show()
            }
        }
    }
}

class HadithReaderActivity : LocalizedActivity() {

    private lateinit var binding: ActivityListBinding
    private val adapter = RowsAdapter()
    private var book: HadithBook? = null
    private var normalized: List<String> = emptyList()
    private var searchJob: Job? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityListBinding.inflate(layoutInflater)
        setContentView(binding.root)
        val info = Hadiths.BOOKS.firstOrNull { it.id == intent.getStringExtra(EXTRA_BOOK) } ?: return finish()
        binding.toolbar.toolbar.title = info.title
        binding.toolbar.toolbar.setNavigationOnClickListener { finish() }
        binding.list.layoutManager = LinearLayoutManager(this)
        binding.list.adapter = adapter

        val search = ViewSearchFieldBinding.inflate(LayoutInflater.from(this), binding.header, true)
        search.editSearchField.setHint(R.string.hadith_search_hint)
        search.editSearchField.doAfterTextChanged { text ->
            searchJob?.cancel()
            searchJob = lifecycleScope.launch {
                delay(250)
                show(text?.toString().orEmpty())
            }
        }

        binding.progress.visibility = View.VISIBLE
        lifecycleScope.launch {
            try {
                val loaded = Hadiths.load(this@HadithReaderActivity, info)
                book = loaded
                normalized = loaded.hadiths.map { QuranSearch.normalize(it.text) }
                binding.progress.visibility = View.GONE
                show("")
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                binding.progress.visibility = View.GONE
                binding.textEmpty.setText(R.string.hadith_download_failed)
                binding.textEmpty.visibility = View.VISIBLE
            }
        }
    }

    private fun show(query: String) {
        val b = book ?: return
        val q = QuranSearch.normalize(query)
        val chapterNames = b.chapters.toMap()
        val rows = ArrayList<Row>()
        var lastChapter = Int.MIN_VALUE
        b.hadiths.forEachIndexed { i, h ->
            if (q.length >= 2 && !normalized[i].contains(q)) return@forEachIndexed
            if (q.length < 2 && h.chapter != lastChapter) {
                chapterNames[h.chapter]?.takeIf { it.isNotBlank() && b.chapters.size > 1 }?.let { rows.add(Row.Section(it)) }
                lastChapter = h.chapter
            }
            rows.add(card(b, h))
        }
        binding.textEmpty.visibility = if (rows.isEmpty()) View.VISIBLE else View.GONE
        binding.textEmpty.setText(R.string.search_empty)
        adapter.submit(rows)
        if (q.length >= 2) binding.list.scrollToPosition(0)
    }

    private fun card(b: HadithBook, h: Hadith) = Row.Card(
        title = getString(R.string.hadith_number, QuranData.toArabicDigits(h.number)),
        body = h.text,
        action1 = getString(R.string.hadith_copy) to {
            val cm = getSystemService(ClipboardManager::class.java)
            cm.setPrimaryClip(ClipData.newPlainText(b.title, "${h.text}\n[${b.title} ${h.number}]"))
            Toast.makeText(this, R.string.hadith_copied, Toast.LENGTH_SHORT).show()
        },
        action2 = getString(R.string.quran_share) to {
            val reference = "${b.title} (${QuranData.toArabicDigits(h.number)})"
            androidx.appcompat.app.AlertDialog.Builder(this)
                .setItems(arrayOf(getString(R.string.share_image), getString(R.string.share_as_text))) { _, which ->
                    if (which == 0) ShareImage.hadith(this, h.text, reference)
                    else startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain")
                        .putExtra(Intent.EXTRA_TEXT, "${h.text}\n[${b.title} ${h.number}]"), null))
                }
                .show()
        }
    )

    companion object {
        const val EXTRA_BOOK = "book"
    }
}

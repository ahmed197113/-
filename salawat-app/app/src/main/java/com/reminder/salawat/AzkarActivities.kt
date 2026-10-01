package com.reminder.salawat

import android.app.Application
import android.content.Intent
import android.os.Bundle
import android.view.HapticFeedbackConstants
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.core.widget.doAfterTextChanged
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.viewModelScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.reminder.salawat.databinding.ActivityAzkarCategoriesBinding
import com.reminder.salawat.databinding.ActivityAzkarDetailBinding
import com.reminder.salawat.databinding.ItemAzkarCategoryBinding
import com.reminder.salawat.databinding.ItemAzkarDuaBinding
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

class AzkarCategoriesActivity : AppCompatActivity() {

    private lateinit var binding: ActivityAzkarCategoriesBinding
    private lateinit var all: List<AzkarCategoryRef>
    private val adapter = CategoryAdapter { ref ->
        startActivity(
            Intent(this, AzkarDetailActivity::class.java)
                .putExtra(AzkarDetailActivity.EXTRA_CATEGORY_ID, ref.id)
                .putExtra(AzkarDetailActivity.EXTRA_CATEGORY_TITLE, ref.title)
        )
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityAzkarCategoriesBinding.inflate(layoutInflater)
        setContentView(binding.root)
        all = AzkarApi.loadCategoryList(this)
        binding.recyclerCategories.layoutManager = LinearLayoutManager(this)
        binding.recyclerCategories.adapter = adapter
        adapter.submit(all)
        binding.editSearch.doAfterTextChanged { text ->
            val q = SurahListActivity.normalize(text?.toString().orEmpty().trim())
            adapter.submit(if (q.isEmpty()) all else all.filter { SurahListActivity.normalize(it.title).contains(q) })
        }
    }

    class CategoryAdapter(private val onClick: (AzkarCategoryRef) -> Unit) :
        RecyclerView.Adapter<CategoryAdapter.ViewHolder>() {
        private var items: List<AzkarCategoryRef> = emptyList()

        @android.annotation.SuppressLint("NotifyDataSetChanged")
        fun submit(list: List<AzkarCategoryRef>) {
            items = list
            notifyDataSetChanged()
        }

        class ViewHolder(val binding: ItemAzkarCategoryBinding) : RecyclerView.ViewHolder(binding.root)

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
            ViewHolder(ItemAzkarCategoryBinding.inflate(LayoutInflater.from(parent.context), parent, false))

        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val item = items[position]
            holder.binding.textCategoryTitle.text = item.title
            holder.itemView.setOnClickListener { onClick(item) }
        }

        override fun getItemCount() = items.size
    }
}

class AzkarDetailViewModel(app: Application) : AndroidViewModel(app) {
    val category = MutableLiveData<AzkarCategory?>(null)
    val loading = MutableLiveData(false)
    val failed = MutableLiveData(false)
    /** Remaining repetitions per item index. */
    val remaining = HashMap<Int, Int>()
    private val player = AudioPlayer { }

    fun load(id: Int) {
        if (category.value != null || loading.value == true) return
        loading.value = true
        failed.value = false
        viewModelScope.launch {
            try {
                category.value = AzkarApi.fetchCategory(getApplication(), id)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                failed.value = true
            } finally {
                loading.value = false
            }
        }
    }

    fun play(url: String) = player.play(url)

    fun stop() = player.stop()

    override fun onCleared() {
        player.stop()
    }
}

class AzkarDetailActivity : AppCompatActivity() {

    private lateinit var binding: ActivityAzkarDetailBinding
    private val viewModel: AzkarDetailViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityAzkarDetailBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val categoryId = intent.getIntExtra(EXTRA_CATEGORY_ID, -1)
        binding.textHeaderTitle.text = intent.getStringExtra(EXTRA_CATEGORY_TITLE) ?: getString(R.string.azkar_title)
        binding.recyclerDuas.layoutManager = LinearLayoutManager(this)
        binding.btnRetry.setOnClickListener { viewModel.load(categoryId) }

        viewModel.loading.observe(this) { binding.progressBar.visibility = if (it) View.VISIBLE else View.GONE }
        viewModel.failed.observe(this) { binding.layoutError.visibility = if (it) View.VISIBLE else View.GONE }
        viewModel.category.observe(this) { category ->
            if (category != null) binding.recyclerDuas.adapter = DuaAdapter(category.items, viewModel)
        }
        viewModel.load(categoryId)
    }

    override fun onDestroy() {
        if (isFinishing) viewModel.stop()
        super.onDestroy()
    }

    class DuaAdapter(
        private val items: List<AzkarItem>,
        private val viewModel: AzkarDetailViewModel
    ) : RecyclerView.Adapter<DuaAdapter.ViewHolder>() {

        class ViewHolder(val binding: ItemAzkarDuaBinding) : RecyclerView.ViewHolder(binding.root)

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
            ViewHolder(ItemAzkarDuaBinding.inflate(LayoutInflater.from(parent.context), parent, false))

        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val item = items[position]
            val context = holder.itemView.context
            holder.binding.textDuaArabic.text = item.text
            val left = viewModel.remaining[position] ?: item.repeat
            val repeatText = context.getString(R.string.azkar_repeat_count, item.repeat)
            holder.binding.textDuaRepeat.text = when {
                left <= 0 -> "$repeatText  ${context.getString(R.string.azkar_done)}"
                item.repeat > 1 -> "$repeatText\n${context.getString(R.string.azkar_remaining, left)}"
                else -> repeatText
            }
            holder.itemView.alpha = if (left <= 0) 0.6f else 1f
            holder.itemView.setOnClickListener { view ->
                val pos = holder.bindingAdapterPosition
                if (pos == RecyclerView.NO_POSITION) return@setOnClickListener
                val current = viewModel.remaining[pos] ?: items[pos].repeat
                if (current <= 0) return@setOnClickListener
                viewModel.remaining[pos] = current - 1
                view.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
                notifyItemChanged(pos)
            }
            if (item.audioUrl.isNotBlank()) {
                holder.binding.btnPlayAudio.visibility = View.VISIBLE
                holder.binding.btnPlayAudio.setOnClickListener { viewModel.play(item.audioUrl) }
            } else {
                holder.binding.btnPlayAudio.visibility = View.GONE
            }
        }

        override fun getItemCount() = items.size
    }

    companion object {
        const val EXTRA_CATEGORY_ID = "category_id"
        const val EXTRA_CATEGORY_TITLE = "category_title"
    }
}

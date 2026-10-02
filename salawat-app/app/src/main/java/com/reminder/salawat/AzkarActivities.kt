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
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.viewModelScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.reminder.salawat.databinding.ActivityAzkarDetailBinding
import com.reminder.salawat.databinding.ItemAzkarDuaBinding
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

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
        binding.toolbar.toolbar.title = intent.getStringExtra(EXTRA_CATEGORY_TITLE) ?: getString(R.string.azkar_title)
        binding.toolbar.toolbar.setNavigationOnClickListener { finish() }
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
            holder.binding.textDuaCounter.text = if (left <= 0) "✓" else QuranData.toArabicDigits(left)
            holder.binding.textDuaRepeat.text = if (left <= 0) context.getString(R.string.azkar_done)
            else "${context.getString(R.string.azkar_repeat_count, item.repeat)}\n${context.getString(R.string.azkar_tap_to_count)}"
            holder.itemView.alpha = if (left <= 0) 0.55f else 1f
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

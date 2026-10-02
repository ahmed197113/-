package com.reminder.salawat

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.widget.doAfterTextChanged
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.reminder.salawat.databinding.FragmentAzkarBinding
import com.reminder.salawat.databinding.HeaderAzkarBinding
import com.reminder.salawat.databinding.ItemAzkarCategoryBinding
import com.reminder.salawat.databinding.ItemAzkarFeaturedBinding

class AzkarFragment : Fragment(R.layout.fragment_azkar) {

    private var _binding: FragmentAzkarBinding? = null
    private val binding get() = _binding!!
    private lateinit var all: List<AzkarCategoryRef>
    private val adapter = Adapter()

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        _binding = FragmentAzkarBinding.bind(view)
        all = AzkarApi.loadCategoryList(view.context)
        binding.recyclerAzkar.layoutManager = LinearLayoutManager(view.context)
        binding.recyclerAzkar.adapter = adapter
        adapter.submit(all, showFeatured = true)
        binding.editSearch.doAfterTextChanged { text ->
            val q = SurahIndex.normalize(text?.toString().orEmpty().trim())
            if (q.isEmpty()) adapter.submit(all, showFeatured = true)
            else adapter.submit(all.filter { SurahIndex.normalize(it.title).contains(q) }, showFeatured = false)
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    private fun open(id: Int, title: String) {
        startActivity(
            Intent(requireContext(), AzkarDetailActivity::class.java)
                .putExtra(AzkarDetailActivity.EXTRA_CATEGORY_ID, id)
                .putExtra(AzkarDetailActivity.EXTRA_CATEGORY_TITLE, title)
        )
    }

    private inner class Adapter : RecyclerView.Adapter<RecyclerView.ViewHolder>() {
        private var items: List<AzkarCategoryRef> = emptyList()
        private var featured = true

        @android.annotation.SuppressLint("NotifyDataSetChanged")
        fun submit(list: List<AzkarCategoryRef>, showFeatured: Boolean) {
            items = list
            featured = showFeatured
            notifyDataSetChanged()
        }

        private val offset get() = if (featured) 1 else 0

        override fun getItemCount() = items.size + offset

        override fun getItemViewType(position: Int) = if (featured && position == 0) 0 else 1

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
            val inflater = LayoutInflater.from(parent.context)
            return if (viewType == 0) {
                val header = HeaderAzkarBinding.inflate(inflater, parent, false)
                FEATURED.forEach { (id, titleRes, icon) ->
                    val card = ItemAzkarFeaturedBinding.inflate(inflater, header.gridFeatured, true)
                    card.iconFeatured.setImageResource(icon)
                    card.textFeatured.setText(titleRes)
                    card.root.setOnClickListener { open(id, getString(titleRes)) }
                }
                HeaderHolder(header)
            } else {
                RowHolder(ItemAzkarCategoryBinding.inflate(inflater, parent, false))
            }
        }

        override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
            if (holder !is RowHolder) return
            val item = items[position - offset]
            holder.b.textCategoryNumber.text = QuranData.toArabicDigits(item.id)
            holder.b.textCategoryTitle.text = item.title
            holder.b.root.setOnClickListener { open(item.id, item.title) }
        }
    }

    private class HeaderHolder(b: HeaderAzkarBinding) : RecyclerView.ViewHolder(b.root)
    private class RowHolder(val b: ItemAzkarCategoryBinding) : RecyclerView.ViewHolder(b.root)

    companion object {
        /** Hisn al-Muslim section ids for the most-used adhkar. */
        private val FEATURED = listOf(
            Triple(27, R.string.azkar_morning_evening, R.drawable.ic_sun),
            Triple(25, R.string.azkar_after_prayer, R.drawable.ic_clock),
            Triple(28, R.string.azkar_sleep, R.drawable.ic_moon),
            Triple(1, R.string.azkar_wakeup, R.drawable.ic_star)
        )
    }
}

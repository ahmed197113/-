package com.reminder.salawat

import android.annotation.SuppressLint
import android.graphics.Typeface
import android.util.TypedValue
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.content.res.ResourcesCompat
import androidx.recyclerview.widget.RecyclerView
import com.reminder.salawat.databinding.ItemCardTextBinding
import com.reminder.salawat.databinding.ItemSectionHeaderBinding

/** Rows for simple content screens: section headers and text cards with up to two actions. */
sealed class Row {
    data class Section(val title: String) : Row()
    data class Card(
        val title: CharSequence?,
        val body: CharSequence,
        val meta: String? = null,
        val quranFont: Boolean = false,
        val bodySp: Float = 17f,
        val action1: Pair<String, () -> Unit>? = null,
        val action2: Pair<String, () -> Unit>? = null,
        val onClick: (() -> Unit)? = null
    ) : Row()
}

class RowsAdapter : RecyclerView.Adapter<RecyclerView.ViewHolder>() {
    private var rows: List<Row> = emptyList()

    @SuppressLint("NotifyDataSetChanged")
    fun submit(list: List<Row>) {
        rows = list
        notifyDataSetChanged()
    }

    override fun getItemCount() = rows.size

    override fun getItemViewType(position: Int) = if (rows[position] is Row.Section) 0 else 1

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        val inflater = LayoutInflater.from(parent.context)
        return if (viewType == 0) SectionHolder(ItemSectionHeaderBinding.inflate(inflater, parent, false))
        else CardHolder(ItemCardTextBinding.inflate(inflater, parent, false))
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        when (val row = rows[position]) {
            is Row.Section -> (holder as SectionHolder).b.textSection.text = row.title
            is Row.Card -> {
                val b = (holder as CardHolder).b
                b.textCardTitle.visibility = if (row.title == null) View.GONE else View.VISIBLE
                b.textCardTitle.text = row.title
                b.textCardBody.text = row.body
                b.textCardBody.typeface = if (row.quranFont) quran(b.root) else ui(b.root)
                b.textCardBody.setTextSize(TypedValue.COMPLEX_UNIT_SP, row.bodySp * Prefs.textScale(b.root.context))
                // Amiri Quran has tall line metrics; keep big single words compact.
                b.textCardBody.setLineSpacing(0f, if (row.bodySp >= 26f) 0.9f else 1.4f)
                b.textCardBody.includeFontPadding = row.bodySp < 26f
                if (row.quranFont && row.bodySp < 26f) Ui.quranLines(b.textCardBody)
                b.textCardMeta.visibility = if (row.meta == null) View.GONE else View.VISIBLE
                b.textCardMeta.text = row.meta
                val hasActions = row.action1 != null || row.action2 != null
                b.rowCardActions.visibility = if (hasActions) View.VISIBLE else View.GONE
                bindAction(b.btnCardAction1, row.action1)
                bindAction(b.btnCardAction2, row.action2)
                if (row.onClick != null) {
                    b.root.isClickable = true
                    b.root.setOnClickListener { row.onClick.invoke() }
                } else {
                    b.root.setOnClickListener(null)
                    b.root.isClickable = false
                }
            }
        }
    }

    private fun bindAction(button: android.widget.Button, action: Pair<String, () -> Unit>?) {
        button.visibility = if (action == null) View.GONE else View.VISIBLE
        button.text = action?.first
        button.setOnClickListener { action?.second?.invoke() }
    }

    private var uiTypeface: Typeface? = null
    private fun ui(view: View): Typeface? =
        uiTypeface ?: ResourcesCompat.getFont(view.context, R.font.tajawal).also { uiTypeface = it }

    private var quranTypeface: Typeface? = null
    private fun quran(view: View): Typeface? =
        quranTypeface ?: ResourcesCompat.getFont(view.context, R.font.kfgqpc_hafs).also { quranTypeface = it }

    private class SectionHolder(val b: ItemSectionHeaderBinding) : RecyclerView.ViewHolder(b.root)
    private class CardHolder(val b: ItemCardTextBinding) : RecyclerView.ViewHolder(b.root)
}

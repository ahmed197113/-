package com.ahmed.tradetimemachine.core

import kotlin.math.max
import kotlin.math.roundToInt
import kotlin.random.Random

data class GameConfig(
    /** Coins per unit of each era's base good, so all eras share one in-game currency. */
    val coinsPerBaseUnit: Int = 10,
    val startingCoins: Int = 300,
    val cargoCapacity: Int = 20,
    val days: Int = 20,
    val travelCost: Int = 20,
    /** Sale price as a fraction of the market price (merchant's margin). */
    val sellRatio: Double = 0.85,
    /** Price move per unit traded, multiplied by the good's scarcity. */
    val pricePressurePerScarcity: Double = 0.03,
    /** Fraction of the gap to the normal price that markets recover each day. */
    val dailyRecovery: Double = 0.35,
    /** A good unknown in an era sells at this multiple of its cheapest home price. */
    val exoticMultiplier: Double = 2.5,
    val eventChance: Double = 0.4,
)

/** One line of the market board in the current era. */
data class Offer(
    val good: Good,
    val buyPrice: Int?,   // null when the era doesn't sell this good
    val sellPrice: Int,
    val owned: Int,
    val isExotic: Boolean,
)

sealed interface TradeResult {
    data class Ok(val quantity: Int, val total: Int, val lesson: String?) : TradeResult
    data object NotEnoughCoins : TradeResult
    data object CargoFull : TradeResult
    data object NothingToSell : TradeResult
    data object NotSoldHere : TradeResult
    data object GameOver : TradeResult
}

sealed interface TravelResult {
    data class Arrived(val era: Era, val event: MarketEvent?) : TravelResult
    data object SameEra : TravelResult
    data object NotEnoughCoins : TravelResult
    data object NoDaysLeft : TravelResult
    data object GameOver : TravelResult
}

class Game(
    val catalog: Catalog = CatalogLoader.loadDefault(),
    val config: GameConfig = GameConfig(),
    private val events: List<MarketEvent> = DEFAULT_EVENTS,
    private val random: Random = Random.Default,
) {
    var coins: Int = config.startingCoins
        private set
    var daysLeft: Int = config.days
        private set
    var currentEra: Era = catalog.eras.first()
        private set
    var isOver: Boolean = false
        private set

    private val cargo = mutableMapOf<String, Int>()
    private val cargoCost = mutableMapOf<String, Int>()      // total coins paid, for profit lessons
    private val cargoOrigin = mutableMapOf<String, String>() // era id where it was last bought

    /** eraId -> goodId -> price multiplier (1.0 = normal). */
    private val pressure = mutableMapOf<String, MutableMap<String, Double>>()

    /** Every good in the game, keyed by id (first definition wins for name/unit). */
    val allGoods: Map<String, Good> = catalog.eras.flatMap { it.goods }.distinctBy { it.id }.associateBy { it.id }

    val cargoUsed: Int get() = cargo.values.sum()

    fun owned(goodId: String): Int = cargo[goodId] ?: 0

    /** Coins plus what the cargo would fetch here. */
    fun netWorth(): Int = coins + cargo.entries.sumOf { (id, n) -> sellPrice(currentEra, id) * n }

    fun offers(): List<Offer> {
        val native = currentEra.goods.map { g ->
            Offer(g, buyPrice(currentEra, g.id), sellPrice(currentEra, g.id), owned(g.id), false)
        }
        val exotic = cargo.keys.filter { id -> currentEra.goods.none { it.id == id } }.map { id ->
            Offer(allGoods.getValue(id), null, sellPrice(currentEra, id), owned(id), true)
        }
        return native + exotic
    }

    fun buyPrice(era: Era, goodId: String): Int? {
        val good = era.goods.find { it.id == goodId } ?: return null
        return max(1, (good.base_price * config.coinsPerBaseUnit * multiplier(era.id, goodId)).roundToInt())
    }

    fun sellPrice(era: Era, goodId: String): Int {
        val market = buyPrice(era, goodId) ?: exoticPrice(era, goodId)
        return max(1, (market * config.sellRatio).roundToInt())
    }

    private fun exoticPrice(era: Era, goodId: String): Int {
        val cheapestHome = catalog.eras.mapNotNull { e -> e.goods.find { it.id == goodId }?.base_price }.min()
        return max(1, (cheapestHome * config.coinsPerBaseUnit * config.exoticMultiplier *
            multiplier(era.id, goodId)).roundToInt())
    }

    private fun multiplier(eraId: String, goodId: String): Double =
        pressure[eraId]?.get(goodId) ?: 1.0

    private fun scarcityIn(era: Era, goodId: String): Int =
        era.goods.find { it.id == goodId }?.scarcity ?: 5

    private fun push(era: Era, goodId: String, direction: Int) {
        val step = config.pricePressurePerScarcity * scarcityIn(era, goodId)
        val m = pressure.getOrPut(era.id) { mutableMapOf() }
        m[goodId] = (multiplier(era.id, goodId) * (1 + direction * step)).coerceIn(0.2, 5.0)
    }

    fun buy(goodId: String, quantity: Int = 1): TradeResult {
        if (isOver) return TradeResult.GameOver
        if (buyPrice(currentEra, goodId) == null) return TradeResult.NotSoldHere
        var bought = 0
        var total = 0
        repeat(quantity) {
            val price = buyPrice(currentEra, goodId)!!
            if (cargoUsed >= config.cargoCapacity) return@repeat
            if (coins < price) return@repeat
            coins -= price
            total += price
            bought++
            cargo[goodId] = owned(goodId) + 1
            cargoCost[goodId] = (cargoCost[goodId] ?: 0) + price
            cargoOrigin[goodId] = currentEra.id
            push(currentEra, goodId, +1)
        }
        if (bought == 0) {
            return if (cargoUsed >= config.cargoCapacity) TradeResult.CargoFull else TradeResult.NotEnoughCoins
        }
        return TradeResult.Ok(bought, total, null)
    }

    fun sell(goodId: String, quantity: Int = 1): TradeResult {
        if (isOver) return TradeResult.GameOver
        val have = owned(goodId)
        if (have == 0) return TradeResult.NothingToSell
        val n = minOf(quantity, have)
        val avgCost = (cargoCost[goodId] ?: 0) / have
        var total = 0
        repeat(n) {
            val price = sellPrice(currentEra, goodId)
            coins += price
            total += price
            push(currentEra, goodId, -1)
        }
        val left = have - n
        if (left == 0) {
            cargo.remove(goodId); cargoCost.remove(goodId)
        } else {
            cargo[goodId] = left; cargoCost[goodId] = avgCost * left
        }
        val origin = cargoOrigin[goodId]?.let { id -> catalog.eras.find { it.id == id } }
        if (left == 0) cargoOrigin.remove(goodId)
        return TradeResult.Ok(n, total, lesson(goodId, origin, avgCost * n, total))
    }

    /** Explains *why* a trade made or lost money, in terms of scarcity. */
    private fun lesson(goodId: String, origin: Era?, cost: Int, revenue: Int): String? {
        if (origin == null || origin.id == currentEra.id) return null
        val good = allGoods.getValue(goodId)
        val profit = revenue - cost
        val here = currentEra.goods.find { it.id == goodId }
        val there = origin.goods.find { it.id == goodId }
        val why = when {
            here == null -> "لم تكن «${good.name_ar}» معروفة في ${currentEra.name_ar}، والشيء النادر يدفع الناس فيه أكثر."
            there != null && here.scarcity > there.scarcity ->
                "«${good.name_ar}» أندر في ${currentEra.name_ar} (ندرة ${here.scarcity}/5) منها في ${origin.name_ar} (${there.scarcity}/5)."
            there != null && here.scarcity < there.scarcity ->
                "«${good.name_ar}» أكثر توفرًا في ${currentEra.name_ar}، فالعرض الكبير يخفض السعر."
            else -> "قيمة «${good.name_ar}» تختلف بين العصرين حسب العرض والطلب."
        }
        val head = if (profit >= 0) "ربحت $profit قطعة." else "خسرت ${-profit} قطعة."
        return "$head $why"
    }

    fun travel(eraId: String): TravelResult {
        if (isOver) return TravelResult.GameOver
        val target = catalog.eras.find { it.id == eraId } ?: error("Unknown era $eraId")
        if (target.id == currentEra.id) return TravelResult.SameEra
        if (daysLeft <= 0) return TravelResult.NoDaysLeft
        if (coins < config.travelCost) return TravelResult.NotEnoughCoins
        coins -= config.travelCost
        daysLeft--
        recoverMarkets()
        currentEra = target
        val event = rollEvent(target)
        return TravelResult.Arrived(target, event)
    }

    private fun recoverMarkets() {
        for (m in pressure.values) {
            for (k in m.keys) m[k] = m.getValue(k) + (1.0 - m.getValue(k)) * config.dailyRecovery
        }
    }

    private fun rollEvent(era: Era): MarketEvent? {
        val candidates = events.filter { it.eraId == era.id }
        if (candidates.isEmpty() || random.nextDouble() >= config.eventChance) return null
        val e = candidates[random.nextInt(candidates.size)]
        val m = pressure.getOrPut(era.id) { mutableMapOf() }
        m[e.goodId] = (multiplier(era.id, e.goodId) * e.multiplier).coerceIn(0.2, 5.0)
        return e
    }

    /** Ends the game; unsold cargo is worthless, so sell before finishing. */
    fun finish(): Int {
        isOver = true
        return coins
    }
}

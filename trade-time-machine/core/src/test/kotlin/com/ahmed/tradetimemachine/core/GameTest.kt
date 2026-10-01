package com.ahmed.tradetimemachine.core

import kotlin.random.Random
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class GameTest {
    private fun newGame(config: GameConfig = GameConfig(eventChance = 0.0)) =
        Game(config = config, random = Random(1))

    @Test
    fun loadsThreeErasFromDesignData() {
        val catalog = CatalogLoader.loadDefault()
        assertEquals(listOf("abbasid_baghdad", "ancient_rome", "pharaonic_egypt"), catalog.eras.map { it.id })
        assertTrue(catalog.eras.all { it.goods.isNotEmpty() })
    }

    @Test
    fun buyingSpendsCoinsAndRaisesPrice() {
        val g = newGame()
        val before = g.buyPrice(g.currentEra, "silk")!!
        val r = g.buy("silk")
        assertIs<TradeResult.Ok>(r)
        assertEquals(300 - before, g.coins)
        assertEquals(1, g.owned("silk"))
        assertTrue(g.buyPrice(g.currentEra, "silk")!! > before, "scarce goods get dearer as you buy")
    }

    @Test
    fun cannotOverspendOrOverfill() {
        val g = newGame(GameConfig(eventChance = 0.0, startingCoins = 10_000, cargoCapacity = 3))
        val r = g.buy("wheat", 10)
        assertEquals(3, (r as TradeResult.Ok).quantity)
        assertEquals(TradeResult.CargoFull, g.buy("wheat"))
        val poor = newGame(GameConfig(eventChance = 0.0, startingCoins = 5))
        assertEquals(TradeResult.NotEnoughCoins, poor.buy("pearls"))
    }

    @Test
    fun silkFromBaghdadSellsAtProfitInRome() {
        val g = newGame()
        g.buy("silk")
        assertIs<TravelResult.Arrived>(g.travel("ancient_rome"))
        val r = g.sell("silk") as TradeResult.Ok
        assertTrue(g.coins > 300, "Rome's silk scarcity should beat Baghdad's price plus travel")
        assertNotNull(r.lesson)
    }

    @Test
    fun exoticGoodsCanBeSoldButNotBought() {
        val g = newGame()
        g.buy("paper")
        g.travel("pharaonic_egypt")
        val offer = g.offers().single { it.good.id == "paper" }
        assertTrue(offer.isExotic)
        assertNull(offer.buyPrice)
        assertEquals(TradeResult.NotSoldHere, g.buy("paper"))
        assertIs<TradeResult.Ok>(g.sell("paper"))
    }

    @Test
    fun travelCostsADayAndCoinsAndMarketsRecover() {
        val g = newGame()
        val base = g.buyPrice(g.currentEra, "silk")!!
        g.buy("silk", 5)
        val baghdad = g.currentEra
        g.travel("ancient_rome")
        assertEquals(19, g.daysLeft)
        g.travel("abbasid_baghdad")
        val after = g.buyPrice(baghdad, "silk")!!
        assertTrue(after < 2 * base && after >= base)
        assertEquals(TravelResult.SameEra, g.travel("abbasid_baghdad"))
    }

    @Test
    fun gameEndsWhenFinished() {
        val g = newGame(GameConfig(eventChance = 0.0, days = 1))
        g.travel("ancient_rome")
        assertEquals(TravelResult.NoDaysLeft, g.travel("pharaonic_egypt"))
        val score = g.finish()
        assertEquals(g.coins, score)
        assertEquals(TradeResult.GameOver, g.buy("wheat"))
    }

    @Test
    fun eventsShiftPrices() {
        val g = Game(config = GameConfig(eventChance = 1.0), random = Random(3))
        val r = g.travel("pharaonic_egypt") as TravelResult.Arrived
        val e = assertNotNull(r.event)
        val normal = Game(config = GameConfig(eventChance = 0.0)).let { it.travel("pharaonic_egypt"); it.buyPrice(it.currentEra, e.goodId)!! }
        assertTrue(g.buyPrice(g.currentEra, e.goodId) != normal)
    }
}

package com.wafr.app

import com.wafr.app.data.Settings
import com.wafr.app.ui.screens.isMonthSwipe
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MonthSwipeTest {
    private val w = 1000f

    @Test fun longDragDecidesEitherWay() {
        assertTrue(isMonthSwipe(300f, w, 0f))
        assertTrue(isMonthSwipe(-300f, w, 0f))
    }

    @Test fun shortSlowDragSnapsBack() {
        assertFalse(isMonthSwipe(150f, w, 200f))
    }

    @Test fun shortFastFlickCounts() {
        assertTrue(isMonthSwipe(150f, w, 3000f))
        assertTrue(isMonthSwipe(-150f, w, -3000f))
    }

    @Test fun flickAgainstTheDragDoesNotCount() {
        assertFalse(isMonthSwipe(150f, w, -3000f))
    }

    @Test fun tinyJitterNeverCounts() {
        assertFalse(isMonthSwipe(40f, w, 5000f))
    }

    @Test fun freshSettingsHaveNoPrivacyAcceptance() {
        assertEquals(0L, Settings().privacyAcceptedAt)
        assertFalse(Settings().onboarded)
    }
}

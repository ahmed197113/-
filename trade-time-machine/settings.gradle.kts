pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
    plugins {
        id("com.android.application") version "8.5.2"
        id("org.jetbrains.kotlin.android") version "2.0.21"
        id("org.jetbrains.kotlin.jvm") version "2.0.21"
        id("org.jetbrains.kotlin.plugin.serialization") version "2.0.21"
    }
}

dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "TradeTimeMachine"

include(":core")
// Pass -PcoreOnly to build/test the game logic without the Android SDK.
if (!providers.gradleProperty("coreOnly").isPresent) {
    include(":app")
}

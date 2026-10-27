plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

// Server va xona tokenini build paytida berish mumkin (masalan maktab uchun maxsus build):
//   gradlew assembleRelease -PdefaultServer=http://192.168.1.10:8000 -PdefaultToken=...
// Aks holda planshetga adb orqali beriladi (README ga qarang).
val defaultServer = (findProperty("defaultServer") as String?) ?: ""
val defaultToken = (findProperty("defaultToken") as String?) ?: ""

android {
    namespace = "uz.darsjadval.tablet"
    compileSdk = 35

    defaultConfig {
        applicationId = "uz.darsjadval.tablet"
        minSdk = 21 // planshet: Android 7.1.2 (API 25)
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
        buildConfigField("String", "DEFAULT_SERVER", "\"$defaultServer\"")
        buildConfigField("String", "DEFAULT_TOKEN", "\"$defaultToken\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // Maktab ichida o'rnatish uchun debug kalit bilan imzolanadi;
            // Play Market uchun alohida release kaliti kerak bo'ladi.
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        // java.time Android 7 da yo'q — desugaring orqali beriladi
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.3")

    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303") // android.jar dagi org.json JVM testlarda ishlamaydi
}

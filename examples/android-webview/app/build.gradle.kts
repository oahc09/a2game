plugins { id("com.android.application") }
val sdkPath = providers.gradleProperty("a2gameSdkDir").orNull
    ?: throw GradleException("Provide -Pa2gameSdkDir=<trusted Player SDK distribution directory>")
val sdkDir = file(sdkPath)
if (!sdkDir.isDirectory || !sdkDir.resolve("player/index.html").isFile ||
    !sdkDir.resolve("player/trusted-bundle.mjs").isFile || !sdkDir.resolve("dist/index.js").isFile ||
    !sdkDir.resolve("build-inventory.json").isFile) {
    throw GradleException("a2gameSdkDir must be a complete trusted Player SDK distribution")
}
android {
    namespace = "org.a2game.webview"
    compileSdk = 35
    buildToolsVersion = "36.0.0"
    defaultConfig {
        applicationId = "org.a2game.webview"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0-alpha"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
    buildTypes { getByName("debug") { signingConfig = null } }
    sourceSets.getByName("main").assets.srcDir(sdkDir)
}
dependencies { implementation("androidx.webkit:webkit:1.14.0") }

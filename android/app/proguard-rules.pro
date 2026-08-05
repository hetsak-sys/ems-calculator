# android/app/proguard-rules.pro
# Added 2026-08-05 alongside minifyEnabled/shrinkResources in build.gradle's
# release buildType. Without these keep rules, R8 can strip or rename classes
# Capacitor's native<->JS bridge depends on reaching by reflection, silently
# breaking plugin calls (camera, filesystem, share, preferences, etc.) in a
# release build that otherwise looks fine.

# Capacitor core bridge
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }

# Keep all Capacitor plugin classes and their methods (reflection-invoked
# from the JS side — @capacitor/preferences, @capacitor/filesystem,
# @capacitor/share, @capacitor/device are the ones this project uses)
-keep class * extends com.getcapacitor.Plugin { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.annotation.PluginMethod <methods>;
}

# WebView JS interface — standard Android requirement, not Capacitor-specific,
# but easy to silently break under minification if omitted
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# If a build failure or runtime warning references a specific missing class
# after this is enabled, add a narrowly-scoped -keep for that class rather
# than widening minifyEnabled false — the failure is telling you exactly
# what reflection path needs protecting.

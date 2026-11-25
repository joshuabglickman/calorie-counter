# Calorie Counter

A simple mobile app (Expo / React Native): log what you ate and how much, and it keeps a calorie total for each day.

## Run it on your phone

Requires Node 22+ (`nvm use 22`).

```bash
npm install
npm start
```

Install **Expo Go** on your phone and scan the QR code shown in the terminal (phone and PC must be on the same Wi-Fi).

## Features

- Type what you ate in plain words ("2 eggs", "brussels sprouts", "200g chicken", "a cup of rice") and the best
  match and its calories are filled in automatically. Typos are tolerated ("brussle sprouts").
- Offline food data: a hand-picked list of common foods (`src/foodDb.ts`) plus ~5,400 foods from the USDA
  FoodData Central survey database (FNDDS), stored in `src/data/usda-foods.json`.
- "Search online" queries the USDA FoodData Central API (includes branded products). It uses the shared
  `DEMO_KEY` (about 10 searches/hour); put a free personal key in `src/online.ts` for more. Foods picked from
  online results are saved on the phone.
- Change the amount or unit and the total updates. Tap "Adjust" to override a value; foods with typed calories are
  remembered.
- Entries are grouped by meal (breakfast, lunch, dinner, snacks) with calorie, net carb, protein and sodium subtotals. Sodium excludes salt added while cooking (USDA recipes list it as an ingredient).
- Daily calorie goal and carb limit (default 20 g), both editable; tap an entry to edit or delete it.
- Daily weight log (lb or kg) with the change since the last weigh-in.
- Blood sugar log: several readings a day with time and an optional tag (fasting, before/after meal, bedtime), in mg/dL or mmol/L.
- Settings (gear icon): choose which columns show in the food list and which items show in the summary at the top.
- Move to earlier days with the arrows; the History tab lists every day's totals plus a 7-day average.
- Data is stored only on the device (AsyncStorage). History → Backup exports a JSON file through the share
  sheet (Google Drive, email, Files) and restores from one.

## Standalone Android app (no PC needed)

Builds an APK locally, using the Android SDK and Android Studio's bundled Java:

```bash
npx expo prebuild --platform android      # generates ./android (not committed)
cd android
JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"   ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```

The APK is written to `android/app/build/outputs/apk/release/app-release.apk`. Copy it to the phone and open it
to install (allow "install unknown apps" when asked). Installing a newer build over it keeps your data.

## Cloud builds and over-the-air updates (EAS)

The installed app downloads JavaScript updates automatically (EAS Update, `preview` channel):

```bash
npx eas-cli@latest update --channel preview --environment preview --message "What changed"   # ship a JS-only change
npx eas-cli@latest build -p android --profile preview                 # new APK (native changes)
```

Updates only reach builds with the same `version` in `app.json` (runtime version policy `appVersion`).
When adding a library with native code, bump `version` and make a new build.

## Rebuilding the USDA food list

Download the "Survey (FNDDS)" CSV zip from https://fdc.nal.usda.gov/download-datasets, unzip it, then run:

```bash
node scripts/build-usda-foods.mjs <path-to-unzipped-csv-folder>
```

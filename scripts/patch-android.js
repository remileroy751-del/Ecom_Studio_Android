// Après « npx cap add android » : ajoute le code natif d'EcomVideoStudio (FFmpeg, import, galerie), l'orientation paysage, les icônes.
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, ".."), android = path.join(root, "android"), overlay = path.join(root, "android-overlay");
const APP_ID = "com.ecomacademy.ecomvideostudio";
const DEP = process.env.FFMPEG_KIT_DEP || "com.mrljdx:ffmpeg-kit-full:6.1.4"; // bibliothèque FFmpeg pour Android (arm64)
const log = m => console.log("[patch-android] " + m);
const rd = f => fs.readFileSync(f, "utf8"), wr = (f, s) => fs.writeFileSync(f, s);
function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  fs.readdirSync(from).forEach(f => { const a = path.join(from, f), b = path.join(to, f); fs.statSync(a).isDirectory() ? copyDir(a, b) : fs.copyFileSync(a, b); });
}
if (!fs.existsSync(android)) { console.error("Dossier android/ absent : lancez d'abord « npx cap add android »."); process.exit(1); }

// 1) Code Java
const jdir = path.join(android, "app/src/main/java", ...APP_ID.split("."));
fs.mkdirSync(jdir, { recursive: true });
fs.readdirSync(path.join(overlay, "java")).forEach(f => fs.copyFileSync(path.join(overlay, "java", f), path.join(jdir, f)));
log("Java : " + fs.readdirSync(jdir).join(", "));

// 2) Icônes (mipmap-*) et couleur de fond de l'icône
copyDir(path.join(overlay, "res"), path.join(android, "app/src/main/res"));
log("icônes copiées");

// 3) Manifeste : paysage + grande mémoire
const mfp = path.join(android, "app/src/main/AndroidManifest.xml");
let mf = rd(mfp);
if (!/screenOrientation/.test(mf)) mf = mf.replace(/(<activity[^>]*?android:name="[^"]*MainActivity")/, '$1\n            android:screenOrientation="sensorLandscape"');
if (!/largeHeap/.test(mf)) mf = mf.replace("<application", '<application\n        android:largeHeap="true"');
if (!/sensorLandscape/.test(mf) || !/largeHeap/.test(mf)) { console.error("Échec du patch du manifeste"); process.exit(1); }
wr(mfp, mf); log("manifeste OK");

// 4) Gradle : dépendance FFmpeg, arm64 uniquement, versions
const gp = path.join(android, "app/build.gradle");
let g = rd(gp);
if (g.indexOf(DEP) < 0) {
  if (!/^dependencies\s*\{/m.test(g)) { console.error("Bloc dependencies introuvable dans app/build.gradle"); process.exit(1); }
  g = g.replace(/^dependencies\s*\{/m, m => m + '\n    implementation "' + DEP + '"');
}
if (!/abiFilters/.test(g)) g = g.replace(/(versionName\s+"[^"]*")/, "$1\n        ndk { abiFilters 'arm64-v8a' }");
g = g.replace(/versionCode\s+\d+/, "versionCode 2").replace(/versionName\s+"[^"]*"/, 'versionName "1.1.0"');
wr(gp, g); log("app/build.gradle OK (" + DEP + ")");

const vp = path.join(android, "variables.gradle");
if (fs.existsSync(vp)) { wr(vp, rd(vp).replace(/minSdkVersion\s*=\s*\d+/, "minSdkVersion = 24")); log("minSdk 24"); }
const pp = path.join(android, "gradle.properties");
if (fs.existsSync(pp)) { let p = rd(pp); p = /org\.gradle\.jvmargs/.test(p) ? p.replace(/org\.gradle\.jvmargs=.*/, "org.gradle.jvmargs=-Xmx3072m -Dfile.encoding=UTF-8") : p + "\norg.gradle.jvmargs=-Xmx3072m -Dfile.encoding=UTF-8\n"; wr(pp, p); }
log("terminé");

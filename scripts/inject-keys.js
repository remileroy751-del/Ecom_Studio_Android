// Écrit src/keys.js à partir du secret GitHub GROQ_API_KEYS (clés séparées par des virgules, espaces ou retours à la ligne).
// Les clés ne sont jamais enregistrées dans le dépôt : elles sont ajoutées au moment de la compilation de l'APK.
const fs = require("fs"), path = require("path");
const raw = String(process.env.GROQ_API_KEYS || "");
const keys = raw.split(/[\s,;]+/).map(k => k.replace(/^["']|["']$/g, "").trim()).filter(Boolean);
const good = [...new Set(keys.filter(k => /^gsk_[A-Za-z0-9]{20,}$/.test(k)))];
if (keys.length && good.length !== keys.length) console.warn("Attention : " + (keys.length - good.length) + " clé(s) ignorée(s) (format gsk_… attendu).");
const out = "/* généré à la compilation depuis le secret GROQ_API_KEYS */\nwindow.__ECOM_KEYS = { groq: " + JSON.stringify(good) + " };\n";
fs.writeFileSync(path.join(__dirname, "..", "src", "keys.js"), out);
console.log("Clés Groq intégrées : " + good.length + (good.length ? "" : " (aucune : l'utilisateur pourra saisir sa clé dans l'application)"));

/* EcomVideoStudio Android — pont natif.
   Remplace l'API Electron (window.ecom) : fichiers, projets, import, FFmpeg natif (export, aperçus, miniatures), licence.
   Le moteur de montage (ffgraph.js : pistes, effets, transitions, textes, stickers) est le même que sur Windows. */
(function () {
  "use strict";
  const Cap = window.Capacitor;
  const N = window.__ECOM_NATIVE__ || (Cap && ((Cap.Plugins && Cap.Plugins.EcomNative) || (Cap.registerPlugin && Cap.registerPlugin("EcomNative")))) || null;
  const FF = window.EcomFF;
  const LICENSE_CFG = { SUPABASE_URL: "https://kmusovomtivrxvqmeipn.supabase.co", SUPABASE_KEY: "sb_publishable_pnAgeFzqzlm_jy5x4eDgIw_gS_GGeaY", TRIAL_DAYS: 14, OFFLINE_GRACE_DAYS: 7 };
  const APP_VERSION = "1.1.0-android";
  let ENV = null;
  const ready = N ? N.setup().then(e => { ENV = e; return e; }) : Promise.reject(new Error("Plugin natif introuvable"));
  ready.catch(e => { try { console.error("EcomNative.init", e); } catch (x) {} });

  /* ---------- URL d'un fichier local (aperçu dans la WebView) ---------- */
  window.EcomPlatform = {
    android: true,
    fileUrl: p => { p = String(p || ""); return Cap && Cap.convertFileSrc ? Cap.convertFileSrc("file://" + p) : "file://" + p; }
  };

  /* ---------- Messages (export) ---------- */
  const MSG = {
    fr: { media: "Médias", missing: "Des fichiers du montage sont introuvables (déplacés ou supprimés). Remettez-les à leur place ou retirez-les du projet :", logSaved: "Journal complet :",
      licenseNeeded: "Licence requise : votre essai gratuit ou votre clé a expiré (ou une vérification en ligne est nécessaire).",
      retryLight: "\nPremier essai interrompu : nouvel essai en mode sécurisé (tous les éléments conservés)…\n", warnLight: "Export terminé en mode sécurisé (aucun élément retiré).",
      retryCaps: "\nLes légendes n'ont pas pu être incrustées, nouvel essai sans légendes…\n", warnCaps: "Export terminé, mais sans les légendes incrustées (moteur vidéo incompatible).",
      retryStk: "\nAnimation des stickers non supportée, nouvel essai avec des stickers fixes…\n", warnStk: "Export terminé, mais les stickers sont fixes (animation non supportée par le moteur vidéo).",
      retryFx: "\nUn effet n'est pas supporté par le moteur vidéo, nouvel essai sans effets…\n", warnFx: "Export terminé, mais sans les effets (non supportés par le moteur vidéo).",
      retryTr: "\nUne transition n'est pas supportée par le moteur vidéo, nouvel essai sans transitions…\n", warnTr: "Export terminé, mais sans les transitions (non supportées par le moteur vidéo).",
      hQueue: "L'encodage a mis trop de temps à démarrer (projet lourd). Réessayez ; en 720p ou 480p c'est plus rapide.", hMem: "Mémoire insuffisante pour cet export. Fermez les autres applications ou choisissez 720p / 480p.",
      hPerm: "Impossible d'écrire le fichier de sortie. Vérifiez l'espace de stockage disponible.", hFile: "Un fichier source est illisible ou introuvable.", hCorrupt: "Un fichier source semble corrompu ou incomplet.",
      saveFail: "La vidéo a été créée mais n'a pas pu être copiée dans la galerie. Vérifiez l'espace de stockage.", notReady: "Moteur vidéo indisponible sur cet appareil.",
      noKey: "Aucune clé API enregistrée pour cette plateforme. Renseignez-la dans le panneau Légendes.", prep: "Préparation de l'audio…", noSound: "Aucun son à transcrire.",
      prepFail: "Préparation audio impossible : ", transcribing: "Transcription en ligne… ({i}/{n})", offline: "Impossible de joindre le service en ligne. Vérifiez votre connexion internet.",
      badKey: "Clé API refusée ou quota atteint. Vérifiez la clé enregistrée. ", err: "Erreur {code} : ", badJson: "Réponse inattendue du service en ligne.",
      noVoice: "Aucune voix française/anglaise hors ligne sur ce téléphone. Installez-en une dans Paramètres › Système › Langues › Synthèse vocale, ou choisissez les voix IA (Gemini).", ttsFail: "Échec de la synthèse vocale :" },
    en: { media: "Media", missing: "Some files used in the project cannot be found (moved or deleted). Put them back or remove them from the project:", logSaved: "Full log:",
      licenseNeeded: "License required: your free trial or key has expired (or an online check is needed).",
      retryLight: "\nFirst attempt interrupted: retrying in safe mode (nothing removed)…\n", warnLight: "Export finished in safe mode (nothing removed).",
      retryCaps: "\nCaptions could not be burned in, retrying without captions…\n", warnCaps: "Export finished, but without burned-in captions (incompatible video engine).",
      retryStk: "\nSticker animation not supported, retrying with static stickers…\n", warnStk: "Export finished, but stickers are static (animation not supported by the video engine).",
      retryFx: "\nAn effect is not supported by the video engine, retrying without effects…\n", warnFx: "Export finished, but without effects (not supported by the video engine).",
      retryTr: "\nA transition is not supported by the video engine, retrying without transitions…\n", warnTr: "Export finished, but without transitions (not supported by the video engine).",
      hQueue: "Encoding took too long to start (heavy project). Try again; 720p or 480p is faster.", hMem: "Not enough memory for this export. Close other apps or choose 720p / 480p.",
      hPerm: "Cannot write the output file. Check the available storage space.", hFile: "A source file is unreadable or missing.", hCorrupt: "A source file looks corrupted or incomplete.",
      saveFail: "The video was created but could not be copied to the gallery. Check the available storage space.", notReady: "Video engine unavailable on this device.",
      noKey: "No API key saved for this provider. Enter it in the Captions panel.", prep: "Preparing audio…", noSound: "No sound to transcribe.",
      prepFail: "Audio preparation failed: ", transcribing: "Online transcription… ({i}/{n})", offline: "Cannot reach the online service. Check your internet connection.",
      badKey: "API key rejected or quota reached. Check the saved key. ", err: "Error {code}: ", badJson: "Unexpected response from the online service.",
      noVoice: "No offline French/English voice on this phone. Install one in Settings › System › Languages › Text-to-speech, or choose the AI voices (Gemini).", ttsFail: "Speech synthesis failed:" }
  };
  let LANG = "fr";
  const M = (k, p) => { let s = (MSG[LANG] || MSG.fr)[k] || MSG.fr[k] || k; if (p) Object.keys(p).forEach(x => { s = s.split("{" + x + "}").join(p[x]); }); return s; };
  const getLangSetting = () => { try { return localStorage.getItem("ecom-lang") || ""; } catch (e) { return ""; } };

  /* ---------- FFmpeg natif ---------- */
  const ERR_RE = /(error|invalid|failed|cannot|unable|no such|not found|too many|does not|not supported|unsupported|permission|denied|matches no streams|out of memory|allocate)/i;
  let ffId = 0;
  async function runFF(args, opts) {
    opts = opts || {};
    await ready;
    const id = "ff" + Date.now().toString(36) + (++ffId);
    let timer = null, off = 0;
    const poll = async () => { try { const r = await N.pollLog({ id, offset: off }); if (r && r.text) { off = r.offset; opts.onData && opts.onData(r.text); } } catch (e) {} };
    if (opts.onData) timer = setInterval(poll, 700);
    let r;
    try { r = await N.runFF({ id, args: args.map(String) }); } catch (e) { r = { code: -1, output: String((e && e.message) || e) }; }
    if (timer) { clearInterval(timer); await poll(); }
    N.clearLog({ id }).catch(() => {});
    const full = String(r.output || ""), errs = [];
    full.split(/[\r\n]+/).forEach(l => { const t = l.trim().slice(0, 300); if (t && ERR_RE.test(t) && !/^\[(libx264|aac)/.test(t) && errs.indexOf(t) < 0) { errs.push(t); if (errs.length > 40) errs.shift(); } });
    return { code: r.code, stderr: full.slice(-6000), errs, full };
  }

  // Encodeur vidéo : libx264 s'il est présent, sinon l'encodeur H.264 matériel d'Android (MediaCodec), sinon MPEG-4 (dernier recours).
  let encoderP = null;
  function pickEncoder() {
    if (encoderP) return encoderP;
    encoderP = (async () => {
      for (const enc of ["libx264", "h264_mediacodec", "mpeg4"]) {
        const a = ["-y", "-hide_banner", "-f", "lavfi", "-i", "color=c=black:s=320x240:r=30:d=0.7"];
        if (enc === "libx264") a.push("-c:v", "libx264", "-preset", "ultrafast");
        else if (enc === "h264_mediacodec") a.push("-c:v", "h264_mediacodec", "-b:v", "1M");
        else a.push("-c:v", "mpeg4", "-q:v", "5");
        a.push("-f", "null", "-");
        const r = await runFF(a);
        if (r.code === 0) return enc;
      }
      return "mpeg4";
    })();
    return encoderP;
  }
  const BITRATE = { "1080": "10M", "720": "6M", "480": "3M" };
  // Remplace « -c:v libx264 -preset X -crf N -pix_fmt yuv420p » par les options de l'encodeur disponible
  function applyEncoder(args, enc, quality) {
    if (enc === "libx264") return args;
    const out = [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === "-c:v" && args[i + 1] === "libx264") {
        if (enc === "h264_mediacodec") out.push("-c:v", "h264_mediacodec", "-b:v", BITRATE[quality] || "8M");
        else out.push("-c:v", "mpeg4", "-q:v", quality === "480" ? "5" : "3", "-pix_fmt", "yuv420p");
        i += 1; continue;
      }
      if (a === "-preset" || a === "-crf") { i += 1; continue; }
      if (a === "-pix_fmt" && enc === "h264_mediacodec") { i += 1; continue; }
      out.push(a);
    }
    return out;
  }

  const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
  async function probe(f) {
    const r = await runFF(["-hide_banner", "-i", f]);
    const s = r.full;
    const d = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(s);
    const duration = d ? (+d[1]) * 3600 + (+d[2]) * 60 + parseFloat(d[3]) : 0;
    const hasVideo = /Stream #.*Video:/.test(s), hasAudio = /Stream #.*Audio:/.test(s);
    const sz = /Video:.*?(\d{2,5})x(\d{2,5})/.exec(s), rot = /rotation of (-?\d+(?:\.\d+)?) degrees/.exec(s);
    let width = sz ? +sz[1] : 0, height = sz ? +sz[2] : 0;
    if (rot && Math.abs(Math.round(+rot[1])) % 180 === 90) { const t = width; width = height; height = t; } // vidéos de téléphone pivotées
    return { duration, hasVideo, hasAudio, width, height };
  }

  /* ---------- Utilitaires ---------- */
  function hash32(str) { // empreinte courte (nom des fichiers d'aperçu)
    let h1 = 0x811c9dc5, h2 = 0x1b873593;
    for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2 ^ c, 2246822519); }
    return (h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0");
  }
  let chain = Promise.resolve();
  const enqueue = fn => { const p = chain.then(fn).catch(() => ""); chain = p; return p; };
  const pid = id => String(id || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60);
  const baseName = p => String(p || "").split(/[\\/]/).pop();

  async function makeProxy(file) {
    await ready;
    const st = await N.stat({ path: file }); if (!st.exists) return "";
    const h = hash32(file + "|" + st.size + "|" + st.mtime), out = ENV.proxies + "/" + h + ".mp4", tmp = ENV.proxies + "/" + h + ".part.mp4";
    const ps = await N.stat({ path: out }); if (ps.exists && ps.size > 1000) return out;
    const enc = await pickEncoder();
    if (enc === "mpeg4") return ""; // le lecteur de l'interface ne sait pas lire le MPEG-4 « part 2 » : on lit alors l'original
    const v = enc === "libx264" ? ["-c:v", "libx264", "-preset", "veryfast", "-crf", "27", "-pix_fmt", "yuv420p"] : ["-c:v", "h264_mediacodec", "-b:v", "2500k"];
    const r = await runFF(["-y", "-hide_banner", "-i", file, "-vf", "scale=w='if(gt(iw,ih),-2,540)':h='if(gt(iw,ih),540,-2)'"].concat(v, ["-g", "15", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", "-f", "mp4", tmp]));
    if (r.code !== 0) { await N.deletePath({ path: tmp }).catch(() => {}); return ""; }
    await N.rename({ from: tmp, to: out }); return out;
  }
  async function makeAudioProxy(file) {
    await ready;
    const st = await N.stat({ path: file }); if (!st.exists) return "";
    const h = hash32(file + "|" + st.size + "|" + st.mtime + "|a"), out = ENV.proxies + "/" + h + ".mp3", tmp = ENV.proxies + "/" + h + ".part.mp3";
    const ps = await N.stat({ path: out }); if (ps.exists && ps.size > 1000) return out;
    const r = await runFF(["-y", "-hide_banner", "-i", file, "-vn", "-map", "0:a:0", "-c:a", "libmp3lame", "-b:a", "160k", "-ar", "44100", "-f", "mp3", tmp]);
    if (r.code !== 0) { await N.deletePath({ path: tmp }).catch(() => {}); return ""; }
    await N.rename({ from: tmp, to: out }); return out;
  }

  /* ---------- Projets ---------- */
  async function writeProject(id, meta, json) {
    id = pid(id); if (!id) return false; await ready;
    await N.writeText({ path: ENV.projets + "/" + id + ".ecomproj", text: json });
    await N.writeText({ path: ENV.projets + "/" + id + ".meta", text: JSON.stringify(Object.assign({}, meta, { id })) });
    return true;
  }

  /* ---------- Licence (essai 14 jours, clés de 30 jours, vérification Supabase) ---------- */
  const License = (() => {
    const DAY = 864e5, SALT = "ecomvs-2026|Ecom_Academy|", te = new TextEncoder();
    let dev = "", memo = null;
    const hex = buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
    async function deviceHash() {
      if (dev) return dev; await ready;
      let raw = ""; try { raw = (await N.deviceId()).id || ""; } catch (e) {}
      if (!raw) { try { raw = localStorage.getItem("ecom-dev") || ""; if (!raw) { raw = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()) + Date.now()); localStorage.setItem("ecom-dev", raw); } } catch (e) { raw = "unknown"; } }
      dev = hex(await crypto.subtle.digest("SHA-256", te.encode("ecomvs|" + raw))); return dev;
    }
    async function sign(s) {
      const k = await crypto.subtle.importKey("raw", te.encode(SALT + await deviceHash()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      return hex(await crypto.subtle.sign("HMAC", k, te.encode(s)));
    }
    async function load() {
      if (memo) return memo;
      let D = null, tampered = false;
      try { await ready; const t = (await N.readText({ path: ENV.base + "/license.dat" })).text; if (t) { const j = JSON.parse(t); if (j && j.d && j.s === await sign(j.d)) D = JSON.parse(j.d); else tampered = true; } } catch (e) {}
      if (!D) D = { first_local: Date.now(), last_seen: 0, country: "", srv: null, skew: 0, checked: 0 };
      if (tampered) D.tampered = true;
      memo = D; return D;
    }
    async function save() { try { const d = JSON.stringify(memo); await N.writeText({ path: ENV.base + "/license.dat", text: JSON.stringify({ d, s: await sign(d) }) }); } catch (e) {} }
    async function evaluate() {
      const D = await load(), now = Date.now() + (D.skew || 0);
      let verify = !!D.tampered;
      if (D.last_seen && now < D.last_seen - 10 * 60e3) verify = true; // horloge reculée
      else if (now > (D.last_seen || 0)) { D.last_seen = now; await save(); }
      const trialEnd = D.srv ? D.srv.trial_end : D.first_local + LICENSE_CFG.TRIAL_DAYS * DAY, lic = D.srv ? D.srv.lic : null;
      let state;
      if (lic && lic > now) state = "licensed"; else if (now < trialEnd) state = "trial"; else state = lic ? "license_expired" : "trial_over";
      if (state === "licensed" && D.checked && now - D.checked > LICENSE_CFG.OFFLINE_GRACE_DAYS * DAY) verify = true;
      const end = state === "licensed" ? lic : trialEnd;
      return { state: verify && (state === "licensed" || state === "trial") ? "verify" : state, pro: !verify && (state === "licensed" || state === "trial"), underlying: state, verify,
        daysLeft: Math.max(0, Math.ceil((end - now) / DAY)), licenseEnd: lic || null, trialEnd, country: D.country || "", needCountry: !D.country, lastCheck: D.checked || 0 };
    }
    async function applyServer(D, d) {
      const srvNow = Date.parse(d.now), local = Date.now();
      D.srv = { first_seen: Date.parse(d.first_seen), trial_end: Date.parse(d.trial_end), lic: d.license_expires_at ? Date.parse(d.license_expires_at) : null };
      D.skew = Math.abs(srvNow - local) > 120000 ? srvNow - local : 0;
      D.checked = srvNow; D.last_seen = srvNow; delete D.tampered; await save();
    }
    async function rpc(fn, body) {
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 9000);
      try {
        const r = await fetch(LICENSE_CFG.SUPABASE_URL + "/rest/v1/rpc/" + fn, { method: "POST", headers: { apikey: LICENSE_CFG.SUPABASE_KEY, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctl.signal });
        const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch (e) {}
        if (!r.ok) return { ok: false, net: false, error: (j && (j.message || j.error)) || "HTTP " + r.status };
        return { ok: true, data: j };
      } catch (e) { return { ok: false, net: true, error: String((e && e.message) || e) }; } finally { clearTimeout(t); }
    }
    return {
      evaluate,
      async ping(country) {
        const D = await load();
        if (country && /^[A-Za-z]{2}$/.test(country)) { D.country = country.toUpperCase(); await save(); }
        const r = await rpc("app_ping", { p_device: await deviceHash(), p_country: D.country || null, p_version: APP_VERSION, p_local_first: new Date(D.first_local).toISOString() });
        const online = r.ok && r.data && r.data.ok === true;
        if (online) await applyServer(D, r.data);
        return Object.assign(await evaluate(), { online });
      },
      async activate(key) {
        const D = await load();
        const r = await rpc("app_activate", { p_device: await deviceHash(), p_key: String(key || "") });
        if (!r.ok) return Object.assign(await evaluate(), { ok: false, error: r.net ? "network" : "server" });
        if (!r.data || r.data.ok !== true) return Object.assign(await evaluate(), { ok: false, error: (r.data && r.data.error) || "server" });
        await applyServer(D, r.data); return Object.assign(await evaluate(), { ok: true });
      },
      async setCountry(c) { const D = await load(); if (/^[A-Za-z]{2}$/.test(String(c || ""))) { D.country = String(c).toUpperCase(); await save(); } return evaluate(); }
    };
  })();

  /* ---------- Export ---------- */
  function explainFF(r) {
    const txt = (r.errs || []).join("\n") + "\n" + (r.stderr || "");
    let hint = "";
    if (/too many packets buffered|muxing queue/i.test(txt)) hint = M("hQueue");
    else if (/cannot allocate memory|out of memory|oom/i.test(txt)) hint = M("hMem");
    else if (/permission denied|no space left/i.test(txt)) hint = M("hPerm");
    else if (/no such file|error opening input|could not open/i.test(txt)) hint = M("hFile");
    else if (/invalid data found|moov atom not found|corrupt/i.test(txt)) hint = M("hCorrupt");
    const lines = (r.errs || []).slice(-6).join("\n");
    return (hint ? hint + "\n\n" : "") + (lines || (r.stderr || "").slice(-500) || "FFmpeg");
  }
  const progressCbs = [];
  const emitProgress = s => progressCbs.forEach(cb => { try { cb(s); } catch (e) {} });

  async function exportVideo(o) {
    const lic = await License.evaluate();
    if (!lic.pro) return { ok: false, license: true, error: M("licenseNeeded") };
    try { await ready; } catch (e) { return { ok: false, error: M("notReady") }; }
    if (!FF) return { ok: false, error: M("notReady") };
    const res = FF.resolutionFor(o.ratio, o.resolution), tmp = (await N.mkTmp()).path;
    try {
      o.video = await Promise.all((o.video || []).map(async (c, i) => {
        const n = Object.assign({}, c);
        if (c.type === "text" && c.img) { const f = tmp + "/text" + i + ".png"; await N.writeBase64({ path: f, data: String(c.img).replace(/^data:image\/png;base64,/, "") }); n.path = f; delete n.img; }
        return n;
      }));
      o.fxDir = ENV.effects;
      const srcFiles = [...new Set(o.video.filter(c => c.type !== "text" && c.path).map(c => c.path).concat((o.audio || []).map(a => a.path)).filter(Boolean))];
      const ex = (await N.exists({ paths: srcFiles })).list || [];
      const gone = srcFiles.filter((f, i) => ex[i] === false);
      if (gone.length) return { ok: false, error: M("missing") + "\n" + gone.slice(0, 6).map(f => " • " + baseName(f)).join("\n") + (gone.length > 6 ? "\n…" : "") };
      // Durées réelles des fichiers : un clip qui démarre après la fin réelle du fichier ferait échouer l'export
      const real = new Map();
      for (const f of srcFiles) { try { real.set(f, (await probe(f)).duration || 0); } catch (e) { real.set(f, 0); } }
      o.video.forEach(c => { if (c.type !== "video" || !c.path) return; const d = real.get(c.path) || 0; if (d <= 0) return; c.mediaDur = d; if ((c.inPoint || 0) > d - 0.1) c.inPoint = Math.max(0, d - 0.1); });
      (o.audio || []).forEach(a => { const d = real.get(a.path) || 0; if (d > 0 && (a.inPoint || 0) > d - 0.05) a.inPoint = Math.max(0, d - 0.05); });
      const caps = (o.captions || []).filter(c => c.text && c.end > c.start);
      let burn = caps.length > 0;
      if (burn) await N.writeText({ path: tmp + "/subs.ass", text: FF.buildAss(caps, res.w, res.h) });
      const enc = await pickEncoder();
      const build = () => applyEncoder(FF.buildExportArgs(o, res, burn, o.output), enc, o.resolution).map(a => typeof a === "string" && a.indexOf("subtitles=filename=subs.ass:fontsdir=.") >= 0 ? a.split("subtitles=filename=subs.ass:fontsdir=.").join("subtitles=filename=" + tmp + "/subs.ass:fontsdir=/system/fonts") : a);
      const run = () => runFF(build(), { onData: emitProgress });
      let r = await run(), warning;
      // Repli progressif : si le moteur vidéo refuse une fonction, on réessaie sans elle (rien n'est retiré au premier repli)
      const steps = [
        { when: () => !o.light, apply: () => { o.light = true; o.tolerant = true; }, retry: "retryLight", warn: "warnLight" },
        { when: () => burn, apply: () => { burn = false; }, retry: "retryCaps", warn: "warnCaps" },
        { when: () => o.video.some(c => c.type === "sticker" || c.type === "text"), apply: () => { o.video = o.video.map(c => Object.assign({}, c, { noAnim: true })); }, retry: "retryStk", warn: "warnStk" },
        { when: () => o.video.some(c => c.fx && c.fx.length), apply: () => { o.video = o.video.map(c => Object.assign({}, c, { noFx: true })); }, retry: "retryFx", warn: "warnFx" },
        { when: () => o.video.some(c => c.trans), apply: () => { o.video = o.video.map(c => Object.assign({}, c, { noTrans: true })); }, retry: "retryTr", warn: "warnTr" }
      ];
      for (const st of steps) {
        if (r.code === 0) break;
        if (!st.when()) continue;
        emitProgress(M(st.retry)); st.apply(); r = await run();
        if (r.code === 0) warning = M(st.warn);
      }
      if (r.code === 0) {
        const saved = await N.saveToGallery({ path: o.output, name: baseName(o.output) });
        if (!saved || !saved.ok) return { ok: false, error: M("saveFail") };
        ENV.lastExportUri = saved.uri || "";
        return { ok: true, output: saved.display, warning };
      }
      let logPath = ENV.logs + "/export-" + Date.now() + ".log";
      try { await N.writeText({ path: logPath, text: "EcomVideoStudio Android — journal d'export\r\n" + new Date().toISOString() + "\r\nEncodeur : " + enc + "\r\n\r\n" + (r.full || r.stderr || "") }); } catch (e) { logPath = ""; }
      return { ok: false, error: explainFF(r) };
    } catch (e) {
      return { ok: false, error: (e && e.message) || String(e) };
    } finally {
      N.deletePath({ path: tmp }).catch(() => {});
      N.deletePath({ path: o.output }).catch(() => {});
    }
  }


  /* ---------- Mode IA : clés, transcription (légendes), voix off, silences ---------- */
  const PROVIDERS = {
    groq: { kind: "openai", url: "https://api.groq.com/openai/v1/audio/transcriptions", model: "whisper-large-v3-turbo" },
    gemini: { kind: "gemini", model: "gemini-2.5-flash", seg: 300 },
    mistral: { kind: "mistral", url: "https://api.mistral.ai/v1/audio/transcriptions", model: "voxtral-mini-latest" },
    openai: { kind: "openai", url: "https://api.openai.com/v1/audio/transcriptions", model: "whisper-1" },
    deepgram: { kind: "deepgram", url: "https://api.deepgram.com/v1/listen", model: "nova-3" }
  };
  const encKey = s => { try { return btoa(unescape(encodeURIComponent(String(s).split("").reverse().join("")))); } catch (e) { return ""; } };
  const decKey = s => { try { return decodeURIComponent(escape(atob(s))).split("").reverse().join(""); } catch (e) { return ""; } };
  const loadAI = () => { try { return JSON.parse(localStorage.getItem("ecom-ai") || "{}") || {}; } catch (e) { return {}; } };
  const saveAI = j => { try { localStorage.setItem("ecom-ai", JSON.stringify(j)); } catch (e) {} };
  // Clés Groq intégrées à l'application au moment de la compilation (src/keys.js, généré depuis les « Secrets » GitHub)
  const embeddedKeys = id => (id === "groq" && window.__ECOM_KEYS && Array.isArray(window.__ECOM_KEYS.groq)) ? window.__ECOM_KEYS.groq.filter(k => typeof k === "string" && k.length > 10) : [];
  let rot = Math.floor(Math.random() * 100);
  function keysFor(id) { // la clé saisie par l'utilisateur d'abord, puis les clés intégrées (en rotation pour répartir les quotas)
    const j = loadAI(), own = j.keys && j.keys[id] ? decKey(j.keys[id]) : "", out = [];
    if (own) out.push(own);
    const emb = embeddedKeys(id);
    for (let i = 0; i < emb.length; i++) { const k = emb[(rot + i) % emb.length]; if (out.indexOf(k) < 0) out.push(k); }
    return out;
  }
  async function withKeys(id, fn) {
    const keys = keysFor(id); let last = null;
    for (const k of keys) {
      try { return await fn(k); }
      catch (e) { last = e; if ([401, 403, 429].indexOf(e && e.status) >= 0) { rot++; continue; } throw e; } // clé refusée ou quota atteint : clé suivante
    }
    throw last || new Error(M("noKey"));
  }
  async function http(o) {
    const r = await N.httpRequest(o);
    if (!r || !r.status) throw Object.assign(new Error(M("offline")), { status: 0 });
    let j = null; try { j = JSON.parse(r.text); } catch (e) {}
    if (r.status < 200 || r.status >= 300) {
      let msg = j ? ((j.error && (j.error.message || j.error)) || j.message || j.err_msg || JSON.stringify(j)) : String(r.text || "").slice(0, 200);
      if (r.status === 401 || r.status === 403) msg = M("badKey") + msg;
      const e = new Error(M("err", { code: r.status }) + (typeof msg === "string" ? msg : JSON.stringify(msg))); e.status = r.status; throw e;
    }
    if (!j) throw new Error(M("badJson"));
    return j;
  }
  const toSec = v => { if (typeof v === "number") return v; const m = String(v || "").split(":").map(parseFloat); return m.reduce((a, x) => a * 60 + (x || 0), 0); };
  const capCbs = [];
  const emitCap = s => capCbs.forEach(cb => { try { cb(s); } catch (e) {} });

  async function callProvider(id, key, file, language, offset) {
    const P = PROVIDERS[id];
    let words = [], segments = [];
    if (P.kind === "openai" || P.kind === "mistral") {
      const fields = [{ name: "model", value: P.model }];
      if (P.kind === "openai") {
        fields.push({ name: "response_format", value: "verbose_json" }, { name: "temperature", value: "0" }, { name: "timestamp_granularities[]", value: "word" }, { name: "timestamp_granularities[]", value: "segment" });
        if (language && language !== "auto") fields.push({ name: "language", value: language });
      } else fields.push({ name: "timestamp_granularities[]", value: "segment" });
      const j = await http({ url: P.url, headers: { Authorization: "Bearer " + key }, multipart: { fields, file: { field: "file", path: file, filename: "audio.mp3", type: "audio/mpeg" } } });
      const segs = (j.segments || []).filter(s => !(s.no_speech_prob > 0.6));
      const inSeg = t => !(j.segments || []).length || segs.some(s => t >= s.start - 0.1 && t <= s.end + 0.1);
      words = (j.words || []).filter(w => inSeg((w.start + w.end) / 2)).map(w => ({ word: String(w.word).trim(), start: w.start + offset, end: w.end + offset }));
      segments = segs.map(s => ({ start: s.start + offset, end: s.end + offset, text: String(s.text).trim() }));
    } else if (P.kind === "deepgram") {
      const q = new URLSearchParams({ model: P.model, smart_format: "true", punctuate: "true" });
      if (language && language !== "auto") q.set("language", language); else q.set("detect_language", "true");
      const j = await http({ url: P.url + "?" + q.toString(), headers: { Authorization: "Token " + key, "Content-Type": "audio/mpeg" }, bodyFile: file });
      const alt = j.results && j.results.channels && j.results.channels[0] && j.results.channels[0].alternatives && j.results.channels[0].alternatives[0];
      words = ((alt && alt.words) || []).map(w => ({ word: String(w.punctuated_word || w.word).trim(), start: w.start + offset, end: w.end + offset }));
    } else if (P.kind === "gemini") {
      const names = { fr: "French", en: "English", pt: "Portuguese", es: "Spanish" };
      const lang = names[language] ? "The speech is in " + names[language] + ". " : "";
      const prompt = "Transcribe the speech in this audio. " + lang + 'Return a JSON array of subtitle segments. Each item has "start" and "end" (seconds, decimal, counted from the beginning of this audio file) and "text" (what is said). Make each segment one short sentence or phrase (at most about 7 seconds). Ignore music and noise. If there is no speech, return [].';
      const data = (await N.readBase64({ path: file })).data;
      const body = JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: "audio/mp3", data } }, { text: prompt }] }],
        generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: { type: "ARRAY", items: { type: "OBJECT", properties: { start: { type: "NUMBER" }, end: { type: "NUMBER" }, text: { type: "STRING" } }, required: ["start", "end", "text"] } } } });
      const call = model => http({ url: "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent", headers: { "x-goog-api-key": key, "Content-Type": "application/json" }, bodyText: body });
      let j; try { j = await call(P.model); } catch (e) { if (/\b404\b/.test(e.message)) j = await call("gemini-flash-latest"); else throw e; }
      let txt = (((j.candidates || [])[0] || {}).content || {}).parts; txt = txt && txt.map(p => p.text || "").join("");
      let arr = []; try { arr = JSON.parse(String(txt || "[]").replace(/^```json|```$/g, "").trim()); } catch (e) { throw new Error(M("badJson")); }
      segments = (Array.isArray(arr) ? arr : []).filter(x => x && x.text).map(x => ({ start: toSec(x.start) + offset, end: Math.max(toSec(x.end), toSec(x.start) + 0.3) + offset, text: String(x.text).trim() }));
    }
    return { words, segments };
  }
  async function transcribe(o) {
    const cfg = loadAI(), id = PROVIDERS[o.provider] ? o.provider : (PROVIDERS[cfg.provider] ? cfg.provider : "groq");
    if (!keysFor(id).length) return { ok: false, error: M("noKey") };
    try { await ready; } catch (e) { return { ok: false, error: M("notReady") }; }
    const tmp = (await N.mkTmp()).path;
    try {
      emitCap(M("prep"));
      const seg = PROVIDERS[id].seg || 600;
      const args = FF.buildTranscribeArgs(o.sources, o.total, tmp + "/chunk%03d.mp3", seg);
      if (!args) return { ok: false, error: M("noSound") };
      const r = await runFF(args);
      if (r.code !== 0) return { ok: false, error: M("prepFail") + r.stderr.slice(-400) };
      const chunks = ((await N.listDir({ dir: tmp })).names || []).filter(f => /^chunk\d+\.mp3$/.test(f)).sort();
      let words = [], segments = [];
      for (let i = 0; i < chunks.length; i++) {
        emitCap(M("transcribing", { i: i + 1, n: chunks.length }));
        const part = await withKeys(id, k => callProvider(id, k, tmp + "/" + chunks[i], o.language, i * seg));
        words = words.concat(part.words); segments = segments.concat(part.segments);
      }
      return { ok: true, words, segments };
    } catch (e) { return { ok: false, error: (e && e.message) || String(e) }; }
    finally { N.deletePath({ path: tmp }).catch(() => {}); }
  }
  async function detectSilence(file) {
    const r = await runFF(["-hide_banner", "-i", file, "-af", "silencedetect=noise=-32dB:d=0.18", "-f", "null", "-"]);
    const txt = r.full || "";
    const sil = [], re = /silence_start: (-?[\d.]+)|silence_end: ([\d.]+)/g; let m, cur = null;
    while ((m = re.exec(txt))) { if (m[1] !== undefined) cur = { start: Math.max(0, parseFloat(m[1])), end: null }; else if (cur) { cur.end = parseFloat(m[2]); sil.push(cur); cur = null; } }
    const d = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec(txt), dur = d ? (+d[1]) * 3600 + (+d[2]) * 60 + parseFloat(d[3]) : 0;
    if (cur) { cur.end = dur || cur.start; sil.push(cur); }
    return { silences: sil, duration: dur };
  }
  async function geminiSpeak(text, gender, out) {
    const key = (keysFor("gemini") || [])[0];
    if (!key) throw new Error(M("noKey"));
    const body = JSON.stringify({ contents: [{ parts: [{ text }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: gender === "male" ? "Puck" : "Kore" } } } } });
    const j = await http({ url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent", headers: { "x-goog-api-key": key, "Content-Type": "application/json" }, bodyText: body });
    const parts = (((j.candidates || [])[0] || {}).content || {}).parts || [];
    const part = parts.find(p => p.inlineData || p.inline_data), data = part && (part.inlineData || part.inline_data).data;
    if (!data) throw new Error(M("badJson"));
    await N.writeBase64({ path: out + ".pcm", data });
    const r = await runFF(["-y", "-hide_banner", "-f", "s16le", "-ar", "24000", "-ac", "1", "-i", out + ".pcm", out]);
    N.deletePath({ path: out + ".pcm" }).catch(() => {});
    if (r.code !== 0) throw new Error("FFmpeg: " + r.stderr.slice(-200));
  }
  async function ttsSynth(o) {
    const lic = await License.evaluate();
    if (!lic.pro) return { ok: false, license: true, error: M("licenseNeeded") };
    try { await ready; } catch (e) { return { ok: false, error: M("notReady") }; }
    const text = String(o.text || "").replace(/\s+/g, " ").trim().slice(0, o.preview ? 160 : 1000);
    if (!text) return { ok: false, error: "Texte vide." };
    const gender = o.gender === "male" ? "male" : "female", lang = o.lang === "en" ? "en" : "fr";
    const dir = o.preview ? ENV.cache : ENV.base + "/Voix";
    const out = dir + "/" + (o.preview ? "ecomvs-apercu" : "voix") + "-" + Date.now() + ".wav";
    try {
      await N.mkdirs({ path: dir });
      let info = "";
      if (o.engine === "gemini") { await geminiSpeak(text, gender, out); info = gender === "male" ? "Puck" : "Kore"; }
      else {
        const r = await N.ttsSynth({ text, lang, gender, out });
        if (!r || !r.ok) return { ok: false, error: (r && r.error === "NOVOICE") ? M("noVoice") : (M("ttsFail") + " " + String((r && r.error) || "")) };
        info = r.voice || "";
      }
      const pr = await probe(out);
      return { ok: true, path: out, duration: pr.duration, voice: info };
    } catch (e) { return { ok: false, error: (e && e.message) || String(e) }; }
  }

  /* ---------- API exposée à l'interface (même nom que sur Windows) ---------- */
  const noop = async () => true;
  window.ecom = {
    openMedia: async kind => { await ready; const r = await N.pickMedia({ kind: kind || "all" }); return (r && r.files || []).map(f => f.path); },
    probe,
    projList: async () => { await ready; const r = await N.listMeta({ dir: ENV.projets }); const out = []; (r.items || []).forEach(t => { try { out.push(JSON.parse(t)); } catch (e) {} }); return out.sort((a, b) => (b.updated || 0) - (a.updated || 0)); },
    projLoad: async id => { await ready; try { return (await N.readText({ path: ENV.projets + "/" + pid(id) + ".ecomproj" })).text || null; } catch (e) { return null; } },
    projSave: async (id, meta, json) => { try { return await writeProject(id, meta, json); } catch (e) { return false; } },
    projSaveSync: (id, meta, json) => { try { writeProject(id, meta, json).catch(() => {}); } catch (e) {} return true; }, // enregistrement « au mieux » quand l'application passe en arrière-plan
    projDelete: async id => { await ready; id = pid(id); for (const x of ["ecomproj", "meta"]) { try { await N.deletePath({ path: ENV.projets + "/" + id + "." + x }); } catch (e) {} } return true; },
    projDir: async () => { await ready; return "Android › EcomVideoStudio › Projets"; },
    openFolder: noop,
    nextExportPath: async (prefix, name) => { await ready; const clean = String(name || "").replace(/\.mp4$/i, "").replace(/[<>:"\/\\|?*\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim().replace(/[. ]+$/, "").slice(0, 80); const d = new Date(), p2 = n => String(n).padStart(2, "0"), st = d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + "-" + p2(d.getHours()) + p2(d.getMinutes()) + p2(d.getSeconds()); const base = clean || (String(prefix || "Export").replace(/[^A-Za-z0-9_-]/g, "") + "-" + st); return ENV.cache + "/exports/" + base + ".mp4"; },
    revealFile: async () => { try { if (ENV && ENV.lastExportUri) await N.openVideo({ uri: ENV.lastExportUri }); } catch (e) {} return true; },
    detectSilence,
    ttsVoices: async () => { try { await ready; return await N.ttsVoices(); } catch (e) { return { ok: false, voices: [] }; } },
    ttsSynth,
    makeProxy: f => enqueue(() => makeProxy(f)),
    makeAudioProxy: f => enqueue(() => makeAudioProxy(f)),
    licenseState: () => License.evaluate(),
    licensePing: c => License.ping(c),
    licenseActivate: k => License.activate(k),
    setCountry: c => License.setCountry(c),
    openExternal: async u => { try { await ready; await N.openExternal({ url: String(u) }); } catch (e) {} return true; },
    filesExist: async a => { await ready; try { return (await N.exists({ paths: Array.isArray(a) ? a : [] })).list || []; } catch (e) { return []; } },
    consumeCrash: async () => false,
    openLogs: noop,
    onPreviewReset: cb => {
      let last = 0;
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") { try { window.dispatchEvent(new Event("beforeunload")); } catch (e) {} return; }
        const n = Date.now(); if (n - last < 3000) return; last = n; setTimeout(() => cb("resume"), 350); // retour dans l'application : les lecteurs vidéo peuvent être noirs
      });
    },
    thumb: async (f, d) => { await ready; try { return (await N.thumb({ file: f, dur: d || 1 })).data || ""; } catch (e) { return ""; } },
    getStickerDir: async () => { await ready; return ENV.stickers; },
    getLang: async () => { LANG = getLangSetting() || ((navigator.language || "fr").toLowerCase().startsWith("fr") ? "fr" : "en"); return LANG; },
    setLang: async l => { LANG = l === "en" ? "en" : "fr"; try { localStorage.setItem("ecom-lang", LANG); } catch (e) {} return LANG; },
    getFxDir: async () => { await ready; return ENV.effects; },
    saveProject: async () => null,
    loadProject: async () => null,
    pickExportPath: async name => { await ready; const b = String(name || "EcomVideoStudio-export.mp4").replace(/\.mp4$/i, "").replace(/[^A-Za-z0-9_\-]+/g, "_"), d = new Date(), p = n => String(n).padStart(2, "0"); return ENV.cache + "/exports/" + b + "_" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "_" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + ".mp4"; },
    exportVideo,
    getSettings: async () => { const j = loadAI(), has = {}; Object.keys(PROVIDERS).forEach(k => { has[k] = keysFor(k).length > 0; }); return { provider: PROVIDERS[j.provider] ? j.provider : "groq", has }; },
    setSettings: async o => { const j = loadAI(); j.keys = j.keys || {}; if (o && PROVIDERS[o.provider]) j.provider = o.provider; if (o && o.key && String(o.key).trim() && PROVIDERS[o.provider]) j.keys[o.provider] = encKey(String(o.key).trim()); saveAI(j); return true; },
    transcribe,
    pathsFromFiles: () => [],
    onExportProgress: cb => { progressCbs.push(cb); },
    onCaptionProgress: cb => { capCbs.push(cb); }
  };
})();

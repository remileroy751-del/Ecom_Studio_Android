// Vérifie que le moteur de montage (ffgraph) produit une commande FFmpeg complète (appelé aussi par la compilation GitHub).
const vm = require("vm"), fs = require("fs"), path = require("path");
const www = path.join(__dirname, "..", "www");
const ctx = { console }; ctx.window = ctx; vm.createContext(ctx);
["anim", "transitions", "effects"].forEach(f => vm.runInContext(fs.readFileSync(path.join(www, f + ".js"), "utf8"), ctx));
vm.runInContext(fs.readFileSync(path.join(www, "ffgraph-web.js"), "utf8"), ctx);
const FF = ctx.EcomFF, res = FF.resolutionFor("9:16", "720");
const a = FF.buildExportArgs({ total: 8, resolution: "720", ratio: "9:16", fxDir: "/x/effects",
  video: [
    { path: "/m/a.mp4", type: "video", track: 0, start: 0, inPoint: 0, duration: 4, scale: 100, x: 0, y: 0, fit: "fill", fx: [] },
    { path: "/m/b.jpg", type: "image", track: 0, start: 4, inPoint: 0, duration: 4, scale: 100, x: 0, y: 0, fit: "fill", fx: [], trans: { id: "fade", dur: 0.8 } }
  ], audio: [{ path: "/m/v.mp3", start: 0, inPoint: 0, duration: 8, volume: 100 }] }, res, false, "/c/out.mp4");
const s = a.join(" ");
if (!/-filter_complex/.test(s) || !/libx264/.test(s) || !/out\.mp4$/.test(s) || a.length < 30) { console.error("Commande FFmpeg incomplète"); process.exit(1); }
console.log("OK : commande FFmpeg de " + a.length + " arguments");

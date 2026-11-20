// Prépare le dossier www/ (interface web embarquée dans l'APK) à partir de src/.
// ffgraph.js (module Node, identique à la version Windows) est enveloppé pour tourner dans la WebView.
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, ".."), src = path.join(root, "src"), www = path.join(root, "www");
fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(www, { recursive: true });
const copy = (from, to) => {
  const st = fs.statSync(from);
  if (st.isDirectory()) { fs.mkdirSync(to, { recursive: true }); fs.readdirSync(from).forEach(f => copy(path.join(from, f), path.join(to, f))); }
  else fs.copyFileSync(from, to);
};
fs.readdirSync(src).forEach(f => { if (f !== "ffgraph.js") copy(path.join(src, f), path.join(www, f)); });
const ff = fs.readFileSync(path.join(src, "ffgraph.js"), "utf8");
const wrapped = "/* généré par scripts/build-www.js à partir de ffgraph.js */\n(function(){\n" +
  "var module={exports:{}};var exports=module.exports;\n" +
  "var __p={join:function(){return Array.prototype.slice.call(arguments).join('/').replace(/\\/+/g,'/');}};\n" +
  "var require=function(n){if(n==='./anim')return window.EcomAnim;if(n==='./effects')return window.EcomFX;if(n==='./transitions')return window.EcomTR;if(n==='path')return __p;throw new Error('require '+n);};\n" +
  ff + "\nwindow.EcomFF=module.exports;\n})();\n";
fs.writeFileSync(path.join(www, "ffgraph-web.js"), wrapped);
console.log("www/ prêt :", fs.readdirSync(www).length, "éléments");

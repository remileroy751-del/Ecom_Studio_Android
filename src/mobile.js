/* EcomVideoStudio Android — adaptation tactile (le moteur de montage reste celui de Windows). */
(function () {
  "use strict";
  document.body.classList.add("android");

  /* ---- Boutons qui remplacent les raccourcis clavier : Annuler (Ctrl+Z), Rétablir (Ctrl+Y), Couper (K), Actualiser (F5) ---- */
  const head = document.querySelector(".timeline-head > div");
  const del = document.getElementById("deleteBtn");
  if (head && del && !document.getElementById("undoBtn")) {
    const mk = (id, html, title) => { const b = document.createElement("button"); b.id = id; b.innerHTML = html; b.title = title; return b; };
    const undoB = mk("undoBtn", "↶ Annuler", "Annuler la dernière action (Ctrl+Z)"), redoB = mk("redoBtn", "↷ Rétablir", "Rétablir (Ctrl+Y)");
    del.insertAdjacentElement("afterend", redoB); del.insertAdjacentElement("afterend", undoB);
    undoB.addEventListener("click", () => { try { undo(); } catch (e) {} });
    redoB.addEventListener("click", () => { try { redo(); } catch (e) {} });
  }
  // Les boutons gardent leurs libellés dans la langue choisie
  const trBtn = () => { try { const en = EcomI18n.lang() === "en"; const u = document.getElementById("undoBtn"), r = document.getElementById("redoBtn"); if (u) u.textContent = en ? "↶ Undo" : "↶ Annuler"; if (r) r.textContent = en ? "↷ Redo" : "↷ Rétablir"; } catch (e) {} };
  document.addEventListener("click", e => { if (e.target.closest && e.target.closest("#langSw")) setTimeout(trBtn, 60); });
  setTimeout(trBtn, 600);

  /* ---- Toucher → souris pour les zones « glisser » (timeline : clips / règle, cadre de l'aperçu, barre de lecture) ----
     Le reste (défilement de la timeline, boutons, curseurs, champs) garde le comportement tactile natif. */
  const DRAG_SEL = "#timeline .clip, #timeline #ruler, #frame, #selBox, #selBox .hd, #scrub";
  let cur = null;
  const mouse = (type, t, tg) => {
    const ev = new MouseEvent(type, { bubbles: true, cancelable: true, view: window, clientX: t.clientX, clientY: t.clientY, screenX: t.screenX, screenY: t.screenY, button: 0, buttons: type === "mouseup" ? 0 : 1 });
    (tg || document).dispatchEvent(ev);
  };
  const findTouch = (e, id) => { for (const t of e.changedTouches) if (t.identifier === id) return t; return null; };
  document.addEventListener("touchstart", e => {
    if (cur || e.touches.length !== 1) return;
    const t = e.changedTouches[0], el = e.target.closest && e.target.closest(DRAG_SEL);
    if (!el || (e.target.closest && e.target.closest("button, input, select, textarea"))) return;
    cur = { id: t.identifier, el: e.target };
    e.preventDefault();
    mouse("mousedown", t, e.target);
  }, { passive: false, capture: true });
  document.addEventListener("touchmove", e => {
    if (!cur) return; const t = findTouch(e, cur.id); if (!t) return;
    e.preventDefault(); mouse("mousemove", t, cur.el.isConnected ? cur.el : document.body);
  }, { passive: false, capture: true });
  const end = e => {
    if (!cur) return; const t = findTouch(e, cur.id); if (!t) return;
    e.preventDefault(); mouse("mouseup", t, cur.el.isConnected ? cur.el : document.body); cur = null;
  };
  document.addEventListener("touchend", end, { passive: false, capture: true });
  document.addEventListener("touchcancel", end, { passive: false, capture: true });

  /* ---- Pas de menu contextuel / sélection de texte accidentelle pendant les gestes ---- */
  document.addEventListener("contextmenu", e => { if (!e.target.closest || !e.target.closest("input, textarea")) e.preventDefault(); });
})();

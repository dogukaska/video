// Gündüz / gece modu düğmesi. Seçim bütün uygulamalarda ortaktır (aynı adres).
(function () {
  var KEY = "tema";
  var root = document.documentElement;
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  if (saved === "light" || saved === "dark") root.setAttribute("data-theme", saved);

  var mq = window.matchMedia("(prefers-color-scheme: dark)");
  function isDark() {
    var t = root.getAttribute("data-theme");
    return t ? t === "dark" : mq.matches;
  }
  var SUN = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>';
  var MOON = '<path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z"/>';

  function paint(btn) {
    var dark = isDark();
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (dark ? SUN : MOON) + "</svg>";
    btn.title = dark ? "Gündüz modu" : "Gece modu";
    btn.setAttribute("aria-label", btn.title);
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i++) { metas[i].setAttribute("content", dark ? "#1f2022" : "#efede8"); metas[i].removeAttribute("media"); }
  }

  function init() {
    var css = document.createElement("style");
    css.textContent =
      ".tema-btn{position:absolute;top:calc(env(safe-area-inset-top) + 16px);right:calc(env(safe-area-inset-right) + 16px);z-index:50;" +
      "width:40px;height:40px;border-radius:50%;display:grid;place-items:center;cursor:pointer;padding:0;color:var(--ink);" +
      "background:var(--glass);border:1px solid var(--glass-edge);box-shadow:var(--shadow);" +
      "-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);transition:transform .15s}" +
      ".tema-btn:active{transform:scale(.92)}";
    document.head.appendChild(css);
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tema-btn";
    btn.addEventListener("click", function () {
      var next = isDark() ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem(KEY, next); } catch (e) {}
      paint(btn);
    });
    mq.addEventListener && mq.addEventListener("change", function () { paint(btn); });
    document.body.appendChild(btn);
    paint(btn);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();

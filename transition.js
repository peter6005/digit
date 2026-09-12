(function () {
  // matches .page-loader's own 0.35s opacity/visibility transition in
  // shared.css, so by the time navigation actually fires the loader has
  // fully faded in rather than jumping from "mostly there" to "fully
  // there" across the handoff
  var EXIT_DURATION = 350;

  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    var link = e.target.closest("a[href]");
    if (!link || link.target === "_blank") return;

    var url;
    try {
      url = new URL(link.href, location.href);
    } catch (err) {
      return;
    }
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && url.hash) return; // in-page anchor

    e.preventDefault();
    document.body.classList.add("page-exit");
    // reveal the loader on THIS page too, not just the destination one —
    // without this, the loader only ever appears after the new document
    // has already started arriving, so there's a beat where the outgoing
    // page is fading to plain white/blank with nothing on it. Showing it
    // here means the last thing painted before the browser unloads this
    // page is the same loader the next page opens with, so the two
    // documents hand off as one continuous loading state instead of a
    // fade-to-blank-then-loader flash
    var loader = document.getElementById("page-loader");
    if (loader) loader.classList.remove("is-hidden");

    setTimeout(function () {
      window.location.href = link.href;
    }, EXIT_DURATION);
  });

  // "page-exit" drives an animation that ends (and, via fill-mode:both,
  // stays) at opacity:0 — fine right up until navigation actually happens,
  // but if the browser later restores THIS page from back/forward cache
  // instead of reloading it (e.g. pressing Back after following a link),
  // the DOM comes back exactly as it was frozen: still carrying
  // "page-exit", still stuck invisible. pageshow fires on every render of
  // the page, bfcache-restored or not, so this is the correct place to
  // reset it — main's animation-name changing back to fk-page-enter also
  // makes it replay, so a restored page gets a fresh little entrance
  // instead of just silently reappearing
  window.addEventListener("pageshow", function () {
    document.body.classList.remove("page-exit");
    // the click handler above reveals the loader before navigating away;
    // if THIS page is what ends up restored from bfcache, it'd otherwise
    // come back with the loader still shown on top of everything
    var loader = document.getElementById("page-loader");
    if (loader) loader.classList.add("is-hidden");
  });
})();

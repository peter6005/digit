// Auto-advancing demo screenshot carousel in the hero's demo-section.
// Landing-page-only behavior (unlike transition.js/shared.css), so it
// lives in its own file rather than bloating the shared one.

(function () {
  var slides = document.querySelectorAll(".demo-slide");
  var dots = document.querySelectorAll(".demo-dot");
  var caption = document.getElementById("demo-caption");
  var carousel = document.getElementById("demo-carousel");
  var prevBtn = document.getElementById("demo-prev");
  var nextBtn = document.getElementById("demo-next");
  var lightbox = document.getElementById("demo-lightbox");
  var lightboxImg = document.getElementById("demo-lightbox-img");
  var lightboxCaption = document.getElementById("demo-lightbox-caption");
  var lightboxClose = document.getElementById("demo-lightbox-close");
  var lightboxPrev = document.getElementById("demo-lightbox-prev");
  var lightboxNext = document.getElementById("demo-lightbox-next");
  if (!slides.length) return;

  var AUTO_MS = 4500;
  var prefersReducedMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var current = 0;
  var timer = null;

  function show(i) {
    current = (i + slides.length) % slides.length;
    slides.forEach(function (s, idx) {
      s.classList.toggle("is-active", idx === current);
    });
    dots.forEach(function (d, idx) {
      d.classList.toggle("is-active", idx === current);
      d.setAttribute("aria-selected", idx === current ? "true" : "false");
    });
    if (caption) caption.textContent = slides[current].dataset.caption;
  }

  function restartAuto() {
    if (timer) clearInterval(timer);
    if (prefersReducedMotion) return;
    // opening the lightbox visually covers #demo-carousel, which fires a
    // mouseleave on it (the pointer is now "over" the lightbox overlay
    // instead) — that would otherwise race right past openLightbox()'s
    // own stopAuto() call and silently resume advancing slides in the
    // background while the lightbox is still showing an old one
    if (lightbox && lightbox.classList.contains("is-open")) return;
    timer = setInterval(function () { show(current + 1); }, AUTO_MS);
  }

  function stopAuto() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  dots.forEach(function (d, idx) {
    d.addEventListener("click", function () {
      show(idx);
      restartAuto();
    });
  });

  if (prevBtn) prevBtn.addEventListener("click", function () {
    show(current - 1);
    restartAuto();
  });
  if (nextBtn) nextBtn.addEventListener("click", function () {
    show(current + 1);
    restartAuto();
  });

  // pause while hovered or while the tab is in the background, so it
  // doesn't keep cycling underneath a reader who's paused on one slide
  if (carousel) {
    carousel.addEventListener("mouseenter", stopAuto);
    carousel.addEventListener("mouseleave", restartAuto);
  }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stopAuto();
    else restartAuto();
  });

  // these screenshots are dense enough that shrunk into the carousel —
  // especially at phone width — the text in them just isn't readable;
  // tapping one opens it full-size instead. show() already updates which
  // slide/dot/caption is "current" — this just also refreshes the
  // lightbox's own <img> to match, so browsing while it's open reuses the
  // exact same state instead of tracking its own separate index.
  // animate=true (stepping to another slide while already open) fades the
  // old image out, swaps src at the midpoint, then fades the new one in —
  // matches .demo-lightbox img's own 0.18s opacity/transform transition
  var LIGHTBOX_SWITCH_MS = 180;

  function updateLightboxImage(animate) {
    var active = slides[current];
    if (!animate) {
      lightboxImg.src = active.src;
      lightboxImg.alt = active.alt;
      if (lightboxCaption) lightboxCaption.textContent = active.dataset.caption;
      return;
    }
    lightboxImg.classList.add("is-switching");
    setTimeout(function () {
      lightboxImg.src = active.src;
      lightboxImg.alt = active.alt;
      if (lightboxCaption) lightboxCaption.textContent = active.dataset.caption;
      // force a style flush so the browser registers the faded-out state
      // before it's removed, or there'd be nothing to transition back from
      void lightboxImg.offsetWidth;
      lightboxImg.classList.remove("is-switching");
    }, LIGHTBOX_SWITCH_MS);
  }

  function openLightbox() {
    if (!lightbox) return;
    updateLightboxImage(false);
    lightbox.classList.add("is-open");
    stopAuto();
    document.addEventListener("keydown", onLightboxKeydown);
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove("is-open");
    document.removeEventListener("keydown", onLightboxKeydown);
    restartAuto();
  }

  function lightboxPrevSlide() {
    show(current - 1);
    updateLightboxImage(true);
  }

  function lightboxNextSlide() {
    show(current + 1);
    updateLightboxImage(true);
  }

  function onLightboxKeydown(e) {
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") lightboxPrevSlide();
    if (e.key === "ArrowRight") lightboxNextSlide();
  }

  slides.forEach(function (s) {
    s.addEventListener("click", openLightbox);
  });
  if (lightboxClose) lightboxClose.addEventListener("click", closeLightbox);
  if (lightbox) lightbox.addEventListener("click", function (e) {
    if (e.target === lightbox) closeLightbox();
  });
  if (lightboxImg) lightboxImg.addEventListener("click", closeLightbox);
  if (lightboxPrev) lightboxPrev.addEventListener("click", lightboxPrevSlide);
  if (lightboxNext) lightboxNext.addEventListener("click", lightboxNextSlide);

  show(0);
  restartAuto();
})();

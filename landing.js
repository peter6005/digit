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

  show(0);
  restartAuto();
})();

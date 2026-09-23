// Renders the tool grid from tools.js's TOOLS array — the whole point of
// pulling that list out into its own file: adding a tool later means
// adding one object there, and this loop just picks it up, no per-tool
// HTML to hand-write here.
//
// each card is a plain <div>, not a wrapping <a> — a tool's image and its
// CTA both need to sit inside it, and a future tool could reasonably want
// more than one clickable thing in its card (e.g. a "docs" link next to
// the main CTA), which a single enclosing link can't support.
(function () {
  var grid = document.getElementById("tools-grid");
  if (!grid || typeof TOOLS === "undefined") return;

  var slideshows = [];

  TOOLS.forEach(function (tool) {
    var card = document.createElement("div");
    card.className = "tool-card";

    if (tool.images && tool.images.length) {
      var slides = document.createElement("a");
      slides.className = "tool-card-slides";
      slides.href = tool.slug + "/";
      slides.tabIndex = -1;
      slides.setAttribute("aria-hidden", "true");
      tool.images.forEach(function (image, i) {
        var img = document.createElement("img");
        img.className = "tool-card-slide" + (i === 0 ? " is-active" : "");
        img.src = image.src;
        img.alt = image.alt || "";
        img.decoding = "async";
        slides.appendChild(img);
      });
      card.appendChild(slides);
      slideshows.push(slides);
    }

    var body = document.createElement("div");
    body.className = "tool-card-body";
    card.appendChild(body);

    var icon = document.createElement("span");
    icon.className = "tool-card-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = tool.icon;
    body.appendChild(icon);

    var name = document.createElement("h3");
    name.className = "tool-card-name";
    name.textContent = tool.name;
    body.appendChild(name);

    var tagline = document.createElement("p");
    tagline.className = "tool-card-tagline";
    tagline.textContent = tool.tagline;
    body.appendChild(tagline);

    var chips = document.createElement("div");
    chips.className = "tool-card-chips";
    tool.chips.forEach(function (chipText) {
      var chip = document.createElement("span");
      chip.className = "tool-card-chip";
      chip.textContent = chipText;
      chips.appendChild(chip);
    });
    body.appendChild(chips);

    var cta = document.createElement("a");
    cta.className = "tool-card-cta";
    cta.href = tool.slug + "/";
    cta.innerHTML = "Megnyitás <span class=\"arrow\">→</span>";
    body.appendChild(cta);

    grid.appendChild(card);
  });

  startSlideshows(slideshows);
})();

// Crossfades each card's screenshots on a timer — deliberately no arrows,
// dots or captions, just the pictures. Cards are staggered so they never
// switch at the same moment, a card only advances while it's on screen
// and the tab is visible, and it waits for the next image to finish
// loading rather than fading to a blank frame. With reduced motion the
// first image simply stays put.
function startSlideshows(slideshows) {
  var INTERVAL_MS = 2500;
  if (!slideshows.length) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var visible = new Map();
  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { visible.set(e.target, e.isIntersecting); });
    });
    slideshows.forEach(function (s) { observer.observe(s); });
  }

  function advance(slides) {
    if (document.hidden || visible.get(slides) === false) return;
    var imgs = slides.children;
    if (imgs.length < 2) return;
    var current = slides.querySelector(".is-active");
    var next = current.nextElementSibling || imgs[0];
    if (!next.complete || !next.naturalWidth) return;
    current.classList.remove("is-active");
    next.classList.add("is-active");
  }

  slideshows.forEach(function (slides, i) {
    var offset = (INTERVAL_MS / slideshows.length) * i;
    setTimeout(function () {
      setInterval(function () { advance(slides); }, INTERVAL_MS);
    }, offset);
  });
}

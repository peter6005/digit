// The single source of truth for what tools exist under the Digit
// umbrella. Adding a new tool later means adding one entry here — nothing
// else needs to know about it by name. Currently only the landing page
// reads this (see landing.js's renderToolCards), but it's a plain global
// rather than something baked into landing.js specifically so any other
// page (e.g. a future "more Digit tools" cross-link) can reuse the exact
// same list instead of hand-copying it.
//
// `images` is optional — the card's thumbnail cycles through them as a
// slideshow, in this order (the first one doubles as the static preview
// when motion is reduced). A tool without screenshots just omits it and
// its card renders without a preview, same layout otherwise. Each tool's
// images live under images/<slug>/, framed at exactly 16:10 so nothing
// gets cropped by the card.
const TOOLS = [
  {
    slug: "vk-tabla",
    name: "VK-tábla",
    icon: "🧮",
    tagline: "3–5 változós logikai függvények elemzése: igazságtáblázat, sorszámos és minimál alakok, V-K tábla, kapu-realizációk, statikus hazárd-javítás.",
    chips: ["Igazságtáblázat", "V-K tábla", "Minimál alakok", "NAND / NOR / NÉV", "Hazárd-javítás", "PDF export"],
    images: [
      { src: "images/vk-tabla/kmap.webp", alt: "Diszjunktív V-K tábla színes csoportokkal és hazárd-javító csoportokkal" },
      { src: "images/vk-tabla/kmap-dualis.webp", alt: "A diszjunktív és a konjunktív V-K tábla egymás mellett" },
      { src: "images/vk-tabla/kmap-5-valtozo.webp", alt: "5 változós V-K tábla két síkkal, 8-as csoporttal" },
      { src: "images/vk-tabla/nev-kapuk.webp", alt: "Minimál alakok és NÉV kapus realizációk" },
      { src: "images/vk-tabla/nand-nor.webp", alt: "NAND és NOR kapus realizáció" },
      { src: "images/vk-tabla/igazsagtabla.webp", alt: "Beállítások és igazságtáblázat" },
      { src: "images/vk-tabla/pdf.webp", alt: "A nyomtatható PDF-összefoglaló első oldala" },
    ],
  },
  {
    slug: "jk-sorszam",
    name: "JK-sorszám",
    icon: "🔁",
    tagline: "Egyedi ciklusú szekvenciális számláló J-K tárolókkal: gerjesztési táblázat, minimalizált vezérlőfüggvények, élő szimuláció, kapcsolási vázlat.",
    chips: ["Állapottábla", "Gerjesztési táblázat", "Élő szimuláció", "Kapcsolási vázlat", "PDF export"],
    images: [
      { src: "images/jk-sorszam/szimulacio.webp", alt: "Élő szimuláció: a 0 → 5 → 3 → 12 → 9 → 6 → 14 ciklus, a 3-as állapot kiemelve" },
      { src: "images/jk-sorszam/kapcsolas.webp", alt: "Színkódolt kapcsolási vázlat négy J-K tárolóval" },
      { src: "images/jk-sorszam/gerjesztes.webp", alt: "Gerjesztési táblázat mind a négy tárolóhoz" },
      { src: "images/jk-sorszam/fuggvenyek.webp", alt: "Minimalizált J és K gerjesztő függvények" },
      { src: "images/jk-sorszam/pdf.webp", alt: "A nyomtatható PDF-összefoglaló első oldala" },
    ],
  },
];

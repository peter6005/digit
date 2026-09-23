// Shared between vk-tabla/app.js and jk-sorszam/app.js: small, generic
// helpers with no dependency on either page's own state, so both pages can
// use the exact same implementation instead of drifting copies.

// creates an SVG element and applies attributes in one step — used by every
// hand-drawn SVG diagram on both pages (K-maps, gate realizations, the
// counter's circuit diagram and sequence strip)
function svgEl(tag, attrs) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs || {}).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

// AND gate: flat left edge, flat top/bottom for the first part, semicircular
// bulge on the right. Total bounding width is exactly w (radius = h/2).
function andGatePath(x, y, w, h) {
  const flatW = w - h / 2;
  const r = h / 2;
  return `M ${x} ${y} L ${x + flatW} ${y} A ${r} ${r} 0 0 1 ${x + flatW} ${y + h} L ${x} ${y + h} Z`;
}

// OR gate: flat back edge (like the AND gate) so straight input jog lines
// always land exactly on it — a concave back curve looked authentic but let
// jog lines poke outside the silhouette wherever the curve bulged away from
// x=gateX
function orGatePath(x, y, w, h) {
  const midY = y + h / 2;
  const tipCtrlX = x + w * 0.62;
  return `M ${x} ${y} L ${x} ${y + h} Q ${tipCtrlX} ${y + h} ${x + w} ${midY} Q ${tipCtrlX} ${y} ${x} ${y} Z`;
}

// Quine-McCluskey-style prime-implicant search: repeatedly combines terms
// that differ in exactly one bit position until nothing more can combine,
// returning whichever combined (or original) terms never got absorbed into
// a larger one. `careSet` is every index that may be merged over (an
// on-set alone for VK-tábla's fully-specified functions, or an on-set +
// don't-cares for JK-sorszám's partially-specified one) —
// callers decide separately which of the resulting groups they actually
// need to cover. `numBits` is the input width and `bitsOf(n)` expands an
// index into its bit array (MSB-first), so callers control both the bit
// ordering and how minterm/state numbers map to bit patterns.
function computePrimeImplicants(careSet, numBits, bitsOf) {
  if (careSet.size === 0) return [];

  const keyOf = bits => bits.join(",");

  const baseTerms = [...careSet].map(m => ({
    bits: bitsOf(m),
    cover: new Set([m]),
  }));

  const allTerms = new Map();
  baseTerms.forEach(t => allTerms.set(keyOf(t.bits), t));
  const usedKeys = new Set();

  let currentLevel = baseTerms;
  let changed = true;
  while (changed) {
    changed = false;
    const nextLevelMap = new Map();

    for (let i = 0; i < currentLevel.length; i++) {
      for (let j = i + 1; j < currentLevel.length; j++) {
        const a = currentLevel[i];
        const b = currentLevel[j];
        let diffPos = -1;
        let diffCount = 0;
        let compatible = true;

        for (let p = 0; p < numBits; p++) {
          const av = a.bits[p];
          const bv = b.bits[p];
          if (av === -1 && bv === -1) continue;
          if (av === -1 || bv === -1) { compatible = false; break; }
          if (av !== bv) {
            diffCount++;
            diffPos = p;
            if (diffCount > 1) break;
          }
        }
        if (!compatible || diffCount !== 1) continue;

        const newBits = a.bits.slice();
        newBits[diffPos] = -1;
        const k = keyOf(newBits);
        usedKeys.add(keyOf(a.bits));
        usedKeys.add(keyOf(b.bits));
        changed = true;

        if (nextLevelMap.has(k)) {
          const merged = nextLevelMap.get(k);
          a.cover.forEach(x => merged.cover.add(x));
          b.cover.forEach(x => merged.cover.add(x));
        } else {
          const merged = { bits: newBits, cover: new Set([...a.cover, ...b.cover]) };
          nextLevelMap.set(k, merged);
          allTerms.set(k, merged);
        }
      }
    }
    currentLevel = [...nextLevelMap.values()];
  }

  return [...allTerms.values()].filter(t => !usedKeys.has(keyOf(t.bits)));
}

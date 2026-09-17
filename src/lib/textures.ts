import * as THREE from "three";

/**
 * Procedural textures drawn on canvases at runtime. Nothing is downloaded;
 * the site is still entirely generated. Each texture is made once and cached.
 */

const cache = new Map<string, THREE.CanvasTexture>();

function canvas(size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void) {
  const el = document.createElement("canvas");
  el.width = size;
  el.height = size;
  const ctx = el.getContext("2d")!;
  draw(ctx, size);
  return el;
}

function make(
  key: string,
  size: number,
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
  repeat: [number, number] = [1, 1],
  srgb = true,
) {
  const hit = cache.get(key);
  if (hit) return hit;
  const texture = new THREE.CanvasTexture(canvas(size, draw));
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.anisotropy = 4;
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, texture);
  return texture;
}

/** Cheap hash noise so textures are stable between renders. */
function noise(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Debris netting: a fine diamond mesh on a transparent ground. */
export function nettingTexture(color = "#ff7a2f") {
  return make(
    `net-${color}`,
    256,
    (ctx, s) => {
      ctx.clearRect(0, 0, s, s);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.4;
      ctx.globalAlpha = 0.9;
      const cell = 16;
      ctx.beginPath();
      for (let i = -s; i < s * 2; i += cell) {
        ctx.moveTo(i, 0);
        ctx.lineTo(i + s, s);
        ctx.moveTo(i + s, 0);
        ctx.lineTo(i, s);
      }
      ctx.stroke();
      // A heavier reinforcing band along the top.
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(0, 4);
      ctx.lineTo(s, 4);
      ctx.stroke();
    },
    [6, 4],
  );
}

/** Black and yellow hazard stripes. */
export function hazardTexture() {
  return make(
    "hazard",
    128,
    (ctx, s) => {
      ctx.fillStyle = "#f0c020";
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = "#15171a";
      const w = s / 4;
      for (let i = -s; i < s * 2; i += w * 2) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + w, 0);
        ctx.lineTo(i + w + s, s);
        ctx.lineTo(i + s, s);
        ctx.closePath();
        ctx.fill();
      }
    },
    [2, 1],
  );
}

/** Poured concrete: mottled grey with pores and faint shutter-board lines. */
export function concreteTexture(seed = 7) {
  return make(
    `concrete-${seed}`,
    512,
    (ctx, s) => {
      const rnd = noise(seed);
      ctx.fillStyle = "#6a7480";
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 9000; i++) {
        const v = 90 + rnd() * 60;
        ctx.fillStyle = `rgba(${v},${v + 6},${v + 14},${0.08 + rnd() * 0.18})`;
        const r = 1 + rnd() * 5;
        ctx.beginPath();
        ctx.arc(rnd() * s, rnd() * s, r, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = 0; i < 260; i++) {
        ctx.fillStyle = `rgba(20,26,34,${0.25 + rnd() * 0.4})`;
        ctx.beginPath();
        ctx.arc(rnd() * s, rnd() * s, 0.6 + rnd() * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = "rgba(30,36,46,0.35)";
      ctx.lineWidth = 1;
      for (let y = s / 6; y < s; y += s / 6) {
        ctx.beginPath();
        ctx.moveTo(0, y + rnd() * 2);
        ctx.lineTo(s, y + rnd() * 2);
        ctx.stroke();
      }
    },
    [2, 2],
  );
}

/** Muddy site ground: dark, uneven, gravelled, tyre-tracked. */
export function groundTexture(seed = 3) {
  return make(
    `ground-${seed}`,
    1024,
    (ctx, s) => {
      const rnd = noise(seed);
      ctx.fillStyle = "#0b1420";
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 2600; i++) {
        const v = rnd();
        ctx.fillStyle = `rgba(${18 + v * 40},${26 + v * 40},${36 + v * 44},${0.12 + rnd() * 0.2})`;
        const r = 6 + rnd() * 60;
        ctx.beginPath();
        ctx.ellipse(rnd() * s, rnd() * s, r, r * (0.4 + rnd() * 0.6), rnd() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = 0; i < 14000; i++) {
        const v = 30 + rnd() * 70;
        ctx.fillStyle = `rgba(${v},${v + 8},${v + 18},${0.25 + rnd() * 0.4})`;
        ctx.fillRect(rnd() * s, rnd() * s, 1 + rnd() * 2, 1 + rnd() * 2);
      }
      ctx.strokeStyle = "rgba(4,8,14,0.55)";
      ctx.lineWidth = 9;
      ctx.setLineDash([14, 9]);
      for (let t = 0; t < 5; t++) {
        const x0 = rnd() * s;
        const y0 = rnd() * s;
        const cx = rnd() * s;
        const cy = rnd() * s;
        const x1 = rnd() * s;
        const y1 = rnd() * s;
        for (const off of [0, 34]) {
          ctx.beginPath();
          ctx.moveTo(x0 + off, y0);
          ctx.quadraticCurveTo(cx + off, cy, x1 + off, y1);
          ctx.stroke();
        }
      }
      ctx.setLineDash([]);
    },
    [10, 10],
  );
}

/** Corrugated metal decking: ribs across the sheet. */
export function deckTexture() {
  return make(
    "deck",
    256,
    (ctx, s) => {
      ctx.fillStyle = "#7d8794";
      ctx.fillRect(0, 0, s, s);
      const rib = 32;
      for (let x = 0; x < s; x += rib) {
        const g = ctx.createLinearGradient(x, 0, x + rib, 0);
        g.addColorStop(0, "#5a6472");
        g.addColorStop(0.35, "#98a2b0");
        g.addColorStop(0.5, "#aeb8c6");
        g.addColorStop(0.65, "#98a2b0");
        g.addColorStop(1, "#5a6472");
        ctx.fillStyle = g;
        ctx.fillRect(x, 0, rib, s);
      }
    },
    [8, 6],
  );
}

/** Plywood hoarding panel: painted, weathered, one panel per tile. */
export function hoardingTexture(seed = 11) {
  return make(
    `hoarding-${seed}`,
    256,
    (ctx, s) => {
      const rnd = noise(seed);
      ctx.fillStyle = "#1d3a5e";
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 500; i++) {
        ctx.fillStyle = `rgba(255,255,255,${rnd() * 0.05})`;
        ctx.fillRect(rnd() * s, rnd() * s, rnd() * 40, 2 + rnd() * 6);
      }
      const g = ctx.createLinearGradient(0, s * 0.7, 0, s);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 6;
      ctx.strokeRect(0, 0, s, s);
    },
    [1, 1],
  );
}

/** Printed site banner on a mesh weave: name, trade, a hazard stripe. */
export function bannerTexture(lines: string[], accent = "#ff6a2b") {
  const texture = make(`banner-${lines.join("|")}`, 1024, (ctx, s) => {
    const w = s;
    const h = s / 2;
    ctx.clearRect(0, 0, s, s);
    ctx.fillStyle = "#f1ece3";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 6) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 6) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, w, 26);
    ctx.fillRect(0, h - 26, w, 26);
    ctx.fillStyle = "#3a4250";
    for (let x = 40; x < w; x += 120) {
      for (const y of [13, h - 13]) {
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = "#0d1b2e";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const big = lines[0] ?? "";
    const size = Math.min(150, ((w * 0.86) / Math.max(1, big.length)) * 1.7);
    ctx.font = `800 ${size}px "Big Shoulders Variable", "Big Shoulders", Impact, sans-serif`;
    ctx.fillText(big.toUpperCase(), 48, h * 0.42);
    ctx.font = `500 44px "Archivo Variable", Archivo, system-ui, sans-serif`;
    ctx.fillStyle = "#3d4a5c";
    ctx.fillText((lines[1] ?? "").toUpperCase(), 52, h * 0.76);
    ctx.textAlign = "right";
    ctx.fillStyle = accent;
    ctx.fillText((lines[2] ?? "").toUpperCase(), w - 48, h * 0.76);
  });
  // Only the top half of the square canvas is printed; sample that half.
  texture.repeat.set(1, 0.5);
  texture.offset.set(0, 0.5);
  return texture;
}

/** Lit office ceiling seen through glass: tiles and light troughs. */
export function ceilingTexture(color = "#f5b043") {
  return make(
    `ceiling-${color}`,
    256,
    (ctx, s) => {
      ctx.fillStyle = "#1a2330";
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 2;
      for (let i = 0; i <= s; i += 32) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, s);
        ctx.moveTo(0, i);
        ctx.lineTo(s, i);
        ctx.stroke();
      }
      ctx.fillStyle = color;
      for (let y = 16; y < s; y += 64) ctx.fillRect(8, y - 4, s - 16, 8);
    },
    [3, 2],
  );
}

/** Fake volumetric beam: opaque at the lamp, fading to nothing. */
export function beamTexture() {
  return make(
    "beam",
    64,
    (ctx, s) => {
      const g = ctx.createLinearGradient(0, 0, 0, s);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.35, "rgba(255,255,255,0.45)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    },
    [1, 1],
    false,
  );
}

/** Steel mesh fencing for the site gate. */
export function fenceTexture() {
  return make(
    "fence",
    128,
    (ctx, s) => {
      ctx.clearRect(0, 0, s, s);
      ctx.strokeStyle = "#b8c0cc";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= s; i += 16) {
        ctx.moveTo(i, 0);
        ctx.lineTo(i, s);
        ctx.moveTo(0, i);
        ctx.lineTo(s, i);
      }
      ctx.stroke();
    },
    [8, 4],
  );
}

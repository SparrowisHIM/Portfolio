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

/**
 * Board-marked concrete, pale.
 *
 * The existing `concreteTexture` fills with #6a7480, which is a mid grey in
 * sRGB and about 0.15 in linear — multiply any material colour by that and
 * the surface lands near 0.10 albedo, which is asphalt. No amount of light
 * fixes it, and a lot of light was spent trying. This one sits around 0.45
 * linear, which is what concrete actually is, and carries the horizontal
 * board lines of an in-situ pour.
 */
export function boardConcreteTexture(seed = 3) {
  return make(
    `board-concrete-${seed}`,
    512,
    (ctx, s) => {
      const rnd = noise(seed);
      ctx.fillStyle = "#b8b2a7";
      ctx.fillRect(0, 0, s, s);

      // Aggregate and pinholes, kept close in value so it reads as a surface
      // rather than as noise.
      for (let i = 0; i < 7000; i++) {
        const v = 168 + rnd() * 34;
        ctx.fillStyle = `rgba(${v},${v - 4},${v - 12},${0.05 + rnd() * 0.14})`;
        ctx.beginPath();
        ctx.arc(rnd() * s, rnd() * s, 0.6 + rnd() * 3.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Shutter boards: a darker line at every joint, with a soft shadow under
      // it, and a faint tone shift board to board.
      const boards = 8;
      const pitch = s / boards;
      for (let i = 0; i <= boards; i++) {
        const y = i * pitch;
        const tone = 0.5 + rnd() * 0.5;
        ctx.fillStyle = `rgba(150,144,134,${0.1 + tone * 0.1})`;
        ctx.fillRect(0, y, s, pitch);
        ctx.fillStyle = "rgba(108,102,94,0.5)";
        ctx.fillRect(0, y - 1, s, 2);
        ctx.fillStyle = "rgba(196,190,180,0.28)";
        ctx.fillRect(0, y + 1, s, 1.5);
      }

      // Tie holes on a regular grid, which is the detail that says in-situ.
      for (let i = 0; i < boards; i += 2) {
        for (let j = 0; j < 4; j++) {
          const x = (j + 0.5) * (s / 4);
          const y = (i + 1) * pitch;
          ctx.fillStyle = "rgba(96,90,82,0.55)";
          ctx.beginPath();
          ctx.arc(x, y, 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // A few pour stains so the surface is not uniform.
      for (let i = 0; i < 14; i++) {
        const x = rnd() * s;
        const y = rnd() * s;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 30 + rnd() * 70);
        g.addColorStop(0, "rgba(150,144,133,0.16)");
        g.addColorStop(1, "rgba(150,144,133,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - 100, y - 100, 200, 200);
      }
    },
    [2, 2],
  );
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

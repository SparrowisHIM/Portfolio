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

/**
 * The site deck: concrete that has been worked on.
 *
 * The plinth top is the largest surface in the hero frame and it was a flat
 * untextured slab — the single flattest thing in the shot. Tracks, damp
 * patches and scuff give it somewhere for the eye to go, and they cost
 * nothing: this is the cheapest way to make a big surface read.
 *
 * Kept dark. It has to sit under the building without competing with it.
 */
export function siteDeckTexture(seed = 17) {
  return make(
    `site-deck-${seed}`,
    512,
    (ctx, s) => {
      const rnd = noise(seed);
      ctx.fillStyle = "#6e6862";
      ctx.fillRect(0, 0, s, s);

      // Damp patches, where water has stood.
      for (let i = 0; i < 18; i++) {
        const x = rnd() * s;
        const y = rnd() * s;
        const r = 30 + rnd() * 110;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(58,54,50,${0.18 + rnd() * 0.22})`);
        g.addColorStop(1, "rgba(58,54,50,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }

      // Dust and dried spill, the other way.
      for (let i = 0; i < 12; i++) {
        const x = rnd() * s;
        const y = rnd() * s;
        const r = 24 + rnd() * 80;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(146,138,127,${0.12 + rnd() * 0.16})`);
        g.addColorStop(1, "rgba(146,138,127,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }

      // Tyre tracks: pairs of bands with a gauge between them, curving a
      // little, because nothing on a site drives in a straight line.
      for (let t = 0; t < 3; t++) {
        const y0 = rnd() * s;
        const drift = (rnd() - 0.5) * 120;
        const gauge = 42 + rnd() * 18;
        for (const off of [0, gauge]) {
          ctx.strokeStyle = `rgba(48,44,41,${0.22 + rnd() * 0.2})`;
          ctx.lineWidth = 9 + rnd() * 5;
          ctx.beginPath();
          ctx.moveTo(-20, y0 + off);
          ctx.bezierCurveTo(s * 0.3, y0 + off + drift, s * 0.7, y0 + off - drift, s + 20, y0 + off);
          ctx.stroke();
        }
      }

      // Aggregate and grit.
      for (let i = 0; i < 6000; i++) {
        const v = 92 + rnd() * 66;
        ctx.fillStyle = `rgba(${v},${v - 4},${v - 10},${0.05 + rnd() * 0.14})`;
        ctx.beginPath();
        ctx.arc(rnd() * s, rnd() * s, 0.5 + rnd() * 2.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Scuff, dragged in one direction.
      for (let i = 0; i < 90; i++) {
        const x = rnd() * s;
        const y = rnd() * s;
        const len = 12 + rnd() * 70;
        ctx.strokeStyle = `rgba(122,115,107,${0.05 + rnd() * 0.1})`;
        ctx.lineWidth = 1 + rnd() * 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + len, y + (rnd() - 0.5) * 10);
        ctx.stroke();
      }
    },
    [4, 4],
  );
}

/**
 * A radial ramp, opaque at the middle and gone at the rim.
 *
 * Used as the alpha map on the ground so the site stands on something that
 * recedes rather than on a disc with an edge. Linear, not sRGB: it is a
 * mask, and putting a transfer curve on a mask bends the falloff.
 */
export function groundFade() {
  return make(
    "ground-fade",
    256,
    (ctx, s) => {
      const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      // Held opaque well out before it goes, so there is real ground round
      // the site and only the far distance dissolves.
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.55, "#ffffff");
      g.addColorStop(0.78, "#8c8c8c");
      g.addColorStop(1, "#000000");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    },
    [1, 1],
    false,
  );
}

/**
 * The ground the site stands on, with the spill from its own lights baked
 * into it.
 *
 * Baked, because the ground is the largest surface in the frame by far and
 * lighting it properly costs more than it is worth: as a lit standard
 * material with the studio cube map on it, this one disc cost a tenth of
 * the frame rate on its own. Unlit with the pool painted in, it costs
 * nothing and looks the same — nothing moves out here.
 */
export function groundSurface(seed = 11) {
  return make(
    `ground-${seed}`,
    512,
    (ctx, s) => {
      const rnd = noise(seed);
      ctx.fillStyle = "#101318";
      ctx.fillRect(0, 0, s, s);
      // Mottle, so it is not a flat wash under the grain of the film.
      for (let i = 0; i < 2600; i++) {
        const v = Math.floor(14 + rnd() * 16);
        ctx.fillStyle = `rgb(${v},${v + 1},${v + 3})`;
        ctx.fillRect(rnd() * s, rnd() * s, 1 + rnd() * 7, 1 + rnd() * 5);
      }
      // Tyre tracks running out of the gate.
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = "#1b1f26";
      ctx.lineWidth = 3;
      for (let i = 0; i < 7; i++) {
        const y = s * 0.5 + (rnd() - 0.5) * s * 0.22;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(s * 0.35, y + (rnd() - 0.5) * 40, s * 0.7, y + (rnd() - 0.5) * 40, s, y + (rnd() - 0.5) * 30);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // The pool of light the site throws on its own ground.
      const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s * 0.115);
      g.addColorStop(0, "rgba(255, 196, 124, 0.30)");
      g.addColorStop(0.45, "rgba(255, 184, 110, 0.13)");
      g.addColorStop(1, "rgba(255, 176, 100, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    },
    [1, 1],
  );
}

/**
 * The contractor's board on the hoarding.
 *
 * Every real site has one, and it is the natural place for a name. Drawn
 * rather than modelled, because at this distance the whole board is a few
 * hundred pixels and the only thing that has to survive is the name.
 */
export const BANNER_ASPECT = 3.6;

export function bannerTexture(name: string, role: string) {
  // The board occupies a band across the middle of a square canvas, and the
  // texture is then cropped to just that band — `make` only draws squares,
  // and a square banner stretched onto a long board stretches the name with
  // it. The band is cut to the board's own aspect so the type comes out
  // the shape it was set in.
  const band = 1 / BANNER_ASPECT;
  const texture = make(
    `banner-${name}-${role}`,
    1024,
    (ctx, s) => {
      const h = s * band;
      const top = (s - h) / 2;
      ctx.fillStyle = "#0a1626";
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = "#0e1c30";
      ctx.fillRect(0, top, s, h);
      // A sodium rule under the name, the way the site's own type is set.
      ctx.fillStyle = "#f5b043";
      ctx.fillRect(s * 0.06, top + h * 0.06, s * 0.055, h * 0.88);

      ctx.textBaseline = "middle";
      const left = s * 0.15;
      const room = s * 0.8 - left;
      /*
        Shrink to fit rather than trusting a size.

        The name is data — it is whatever is in projects.ts — and at the
        first guess "EFE EBOMWONYI" ran off the end of the board and lost
        its last letter. Measuring costs nothing and means the board works
        for any name.
      */
      const fit = (text: string, weight: number, stack: string, wanted: number) => {
        let px = wanted;
        ctx.font = `${weight} ${Math.round(px)}px ${stack}`;
        while (px > 8 && ctx.measureText(text).width > room) {
          px -= 2;
          ctx.font = `${weight} ${Math.round(px)}px ${stack}`;
        }
      };

      ctx.fillStyle = "#f1ece3";
      // Big Shoulders is loaded by the time the scene mounts; Impact is the
      // fallback and is close enough in build that the board still reads.
      fit(name.toUpperCase(), 700, '"Big Shoulders Variable", Impact, "Arial Narrow", sans-serif', h * 0.42);
      ctx.fillText(name.toUpperCase(), left, top + h * 0.38);

      ctx.fillStyle = "#9aa6b8";
      fit(role.toUpperCase(), 500, '"Archivo Variable", Archivo, system-ui, sans-serif', h * 0.17);
      ctx.fillText(role.toUpperCase(), left, top + h * 0.7);

      // Edge wear, so it is a board that has been outside.
      const rnd = noise(41);
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = "#000000";
      for (let i = 0; i < 320; i++) {
        const x = rnd() * s;
        const y = top + rnd() * h;
        ctx.fillRect(x, y, rnd() * 6, rnd() * 3);
      }
      ctx.globalAlpha = 1;
    },
    [1, 1],
  );
  texture.offset.set(0, (1 - band) / 2);
  texture.repeat.set(1, band);
  return texture;
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

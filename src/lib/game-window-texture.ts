import * as THREE from "three";

/** One small shared atlas-like room image; the piers, sills and glazing bars are geometry. */
export function gameWindowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const wash = ctx.createLinearGradient(0, 0, 0, 256);
  wash.addColorStop(0, "#344752");
  wash.addColorStop(0.24, "#a7a89c");
  wash.addColorStop(0.7, "#767b73");
  wash.addColorStop(1, "#273b48");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, 256, 256);
  // The room recedes from the glass into a darker back wall.
  ctx.fillStyle = "#535f62";
  ctx.fillRect(40, 46, 176, 146);
  ctx.fillStyle = "#758184";
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(40, 46); ctx.lineTo(40, 192); ctx.lineTo(0, 256); ctx.fill();
  ctx.fillStyle = "#354954";
  ctx.beginPath(); ctx.moveTo(256, 0); ctx.lineTo(216, 46); ctx.lineTo(216, 192); ctx.lineTo(256, 256); ctx.fill();
  // Ceiling trough, suspended luminaires, a desk and partition silhouettes.
  ctx.fillStyle = "#f3e7c4";
  ctx.fillRect(51, 25, 150, 6);
  ctx.fillStyle = "#9ea297";
  ctx.fillRect(53, 64, 3, 117);
  ctx.fillRect(179, 64, 3, 117);
  ctx.fillStyle = "#293e4a";
  ctx.fillRect(25, 169, 201, 10);
  ctx.fillRect(42, 179, 7, 37);
  ctx.fillRect(187, 179, 7, 37);
  ctx.fillStyle = "#203340";
  ctx.fillRect(140, 137, 39, 27);
  ctx.fillRect(156, 164, 5, 8);
  ctx.fillStyle = "#738389";
  ctx.fillRect(143, 140, 33, 20);
  // Faint reflected sky crosses the room; no expensive per-pane refraction.
  ctx.fillStyle = "rgba(176,205,225,0.10)";
  ctx.beginPath(); ctx.moveTo(40, 0); ctx.lineTo(94, 0); ctx.lineTo(218, 256); ctx.lineTo(164, 256); ctx.fill();
  const vignette = ctx.createLinearGradient(0, 0, 256, 0);
  vignette.addColorStop(0, "rgba(0,8,16,.6)");
  vignette.addColorStop(0.13, "rgba(0,8,16,0)");
  vignette.addColorStop(0.87, "rgba(0,8,16,0)");
  vignette.addColorStop(1, "rgba(0,8,16,.6)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

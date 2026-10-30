// Rasterizes the TatNat brand SVGs (public/brand/*.svg, owned by Marketing —
// see company/projects/barber-shop/look-and-feel.md §4.4) into the PNG sizes
// the favicon, apple-touch-icon and PWA manifest need. Re-run this whenever
// the brand SVGs change; it is not part of `next build`.
//
// Uses `sharp` (already present via Next's image pipeline — no new dependency).
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const brand = (name) => readFileSync(path.join(root, "public/brand", name));
const out = (name) => path.join(root, "public/icons", name);

async function render(svgBuf, size, dest) {
  await sharp(svgBuf, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(dest);
  console.log("wrote", path.relative(root, dest), `${size}x${size}`);
}

async function main() {
  const icon = brand("icon.svg"); // full detail, light — apple/192/512/maskable
  const iconMark = brand("icon-mark.svg"); // small-size-safe, light — favicon 16/32
  const iconMarkDark = brand("icon-mark-dark.svg"); // favicon 16/32, dark media query

  // icon.svg's own safe-zone comment (rim r=168 of 256, well inside the ~80%
  // adaptive-icon safe circle) means no extra padding is needed for maskable —
  // see look-and-feel.md §4.4 legibility check.
  await render(icon, 192, out("icon-192.png"));
  await render(icon, 512, out("icon-512.png"));
  await render(icon, 512, out("icon-maskable-512.png"));
  await render(icon, 180, out("apple-touch-icon.png"));

  await render(iconMark, 16, out("favicon-16.png"));
  await render(iconMark, 32, out("favicon-32.png"));
  await render(iconMarkDark, 16, out("favicon-16-dark.png"));
  await render(iconMarkDark, 32, out("favicon-32-dark.png"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

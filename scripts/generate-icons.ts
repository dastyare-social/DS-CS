import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const APP_DIR = path.join(process.cwd(), "src", "app");
const SOURCE_IMAGE = path.join(PUBLIC_DIR, "profile_image.png");

const FAVICON_SIZES = [16, 32, 48] as const;

function assert_source_exists() {
  if (!fs.existsSync(SOURCE_IMAGE)) {
    throw new Error(`Source image not found: ${SOURCE_IMAGE}`);
  }
}

async function crop_to_square(): Promise<Buffer> {
  const image = sharp(SOURCE_IMAGE);
  const { width, height } = await image.metadata();

  if (!width || !height) {
    throw new Error(`Could not read dimensions of ${SOURCE_IMAGE}`);
  }

  const size = Math.min(width, height);
  const left = Math.floor((width - size) / 2);
  const top = Math.floor((height - size) / 2);

  return image
    .extract({ left, top, width: size, height: size })
    .png()
    .toBuffer();
}

function circle_mask_svg(size: number): Buffer {
  return Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`
  );
}

// Full-circle cutout, transparent outside the circle. Used only for the browser-tab
// favicon, which the OS never re-masks — no browser applies its own shape on top.
async function round_transparent(square: Buffer, size: number): Promise<Buffer> {
  const resized = await sharp(square)
    .resize(size, size, { fit: "cover" })
    .toBuffer();

  return sharp(resized)
    .composite([{ input: circle_mask_svg(size), blend: "dest-in" }])
    .png()
    .toBuffer();
}

// Plain square resize, no rounding. Used for iOS/Android home-screen icons: both
// platforms apply their own icon-shape mask on top of whatever you give them
// (iOS's rounded-squircle, Android's adaptive-icon shape). Pre-rounding here would
// get double-masked and clipped unpredictably, so these stay full-bleed squares.
async function square_icon(square: Buffer, size: number): Promise<Buffer> {
  return sharp(square)
    .resize(size, size, { fit: "cover" })
    .png()
    .toBuffer();
}

// Minimal ICO encoder: embeds PNG frames directly in the ICO container. Every
// browser in active use supports PNG-in-ICO (since IE11 / Vista), so this avoids
// pulling in a separate ico-encoding dependency just for a 3-frame favicon.
function encode_ico(frames: { size: number; data: Buffer }[]): Buffer {
  const HEADER_SIZE = 6;
  const ENTRY_SIZE = 16;

  const header = Buffer.alloc(HEADER_SIZE);
  header.writeUInt16LE(0, 0); // reserved, must be 0
  header.writeUInt16LE(1, 2); // image type: 1 = icon
  header.writeUInt16LE(frames.length, 4); // number of images

  let offset = HEADER_SIZE + ENTRY_SIZE * frames.length;
  const entries: Buffer[] = [];
  const images: Buffer[] = [];

  for (const { size, data } of frames) {
    const entry = Buffer.alloc(ENTRY_SIZE);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width, 0 means 256
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height, 0 means 256
    entry.writeUInt8(0, 2); // color palette (0 = no palette)
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8); // size of image data
    entry.writeUInt32LE(offset, 12); // offset of image data from file start
    entries.push(entry);
    images.push(data);
    offset += data.length;
  }

  return Buffer.concat([header, ...entries, ...images]);
}

async function write_favicon_ico(square: Buffer) {
  const frames = await Promise.all(
    FAVICON_SIZES.map(async (size) => ({
      size,
      data: await round_transparent(square, size),
    }))
  );

  fs.writeFileSync(path.join(APP_DIR, "favicon.ico"), encode_ico(frames));
}

async function main() {
  console.log("Generating favicon + PWA icons from public/profile_image.png...");

  assert_source_exists();
  const square = await crop_to_square();

  await write_favicon_ico(square);

  fs.writeFileSync(
    path.join(APP_DIR, "icon.png"),
    await round_transparent(square, 512)
  );
  fs.writeFileSync(
    path.join(APP_DIR, "apple-icon.png"),
    await square_icon(square, 180)
  );
  fs.writeFileSync(
    path.join(PUBLIC_DIR, "web-app-manifest-192x192.png"),
    await square_icon(square, 192)
  );
  fs.writeFileSync(
    path.join(PUBLIC_DIR, "web-app-manifest-512x512.png"),
    await square_icon(square, 512)
  );

  console.log("Generated:");
  console.log("  src/app/favicon.ico");
  console.log("  src/app/icon.png");
  console.log("  src/app/apple-icon.png");
  console.log("  public/web-app-manifest-192x192.png");
  console.log("  public/web-app-manifest-512x512.png");
}

main().catch((err) => {
  console.error("[generate-icons] failed:", err);
  process.exit(1);
});
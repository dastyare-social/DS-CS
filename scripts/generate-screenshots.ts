import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const SCREENSHOT_DIR = path.join(PUBLIC_DIR, "screenshots");
const BACKGROUND = path.join(PUBLIC_DIR, "bg-image.png");
const PROFILE_IMAGE = path.join(PUBLIC_DIR, "profile-image.png");
const APP_NAME = "Omid Shabab";

type Shot = {
  file: string;
  width: number;
  height: number;
  name_y: number;
  name_font_size: number;
  icon_size: number;
  icon_y: number;
};

const SHOTS: Shot[] = [
  {
    file: "wide-1280x720.png",
    width: 1280,
    height: 720,
    name_y: 200,
    name_font_size: 72,
    icon_size: 192,
    icon_y: 300,
  },
  {
    file: "mobile-750x1334.png",
    width: 750,
    height: 1334,
    name_y: 520,
    name_font_size: 58,
    icon_size: 170,
    icon_y: 640,
  },
];

function assert_source_exists() {
  for (const file of [BACKGROUND, PROFILE_IMAGE]) {
    if (!fs.existsSync(file)) {
      throw new Error(`Source image not found: ${file}`);
    }
  }
}

async function crop_profile_square(): Promise<Buffer> {
  const image = sharp(PROFILE_IMAGE);
  const { width, height } = await image.metadata();

  if (!width || !height) {
    throw new Error(`Could not read dimensions of ${PROFILE_IMAGE}`);
  }

  const size = Math.min(width, height);
  const left = Math.floor((width - size) / 2);
  const top = Math.floor((height - size) / 2);

  return image
    .extract({ left, top, width: size, height: size })
    .png()
    .toBuffer();
}

function name_overlay_svg(shot: Shot): Buffer {
  const { width, height, name_y, name_font_size } = shot;
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <text x="50%" y="${name_y}" text-anchor="middle"
            font-family="Helvetica, Arial, sans-serif" font-size="${name_font_size}"
            font-weight="700" fill="#ffffff"
            stroke="rgba(0,0,0,0.45)" stroke-width="3" paint-order="stroke">
        ${APP_NAME}
      </text>
    </svg>`
  );
}

async function render_shot(shot: Shot, profile_square: Buffer) {
  const background = sharp(BACKGROUND);
  const { width: bgW, height: bgH } = await background.metadata();
  if (!bgW || !bgH) throw new Error(`Could not read dimensions of ${BACKGROUND}`);

  const cover = background.resize(shot.width, shot.height, { fit: "cover" });
  const icon = await sharp(profile_square)
    .resize(shot.icon_size, shot.icon_size, { fit: "cover" })
    .png()
    .toBuffer();

  const icon_x = Math.floor((shot.width - shot.icon_size) / 2);

  const output = await cover
    .composite([
      { input: name_overlay_svg(shot) },
      { input: icon, left: icon_x, top: shot.icon_y },
    ])
    .png()
    .toBuffer();

  return output;
}

async function main() {
  console.log(`Generating PWA screenshots into ${SCREENSHOT_DIR}...`);

  assert_source_exists();
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const profile_square = await crop_profile_square();

  for (const shot of SHOTS) {
    const data = await render_shot(shot, profile_square);
    fs.writeFileSync(path.join(SCREENSHOT_DIR, shot.file), data);
    console.log(`  public/screenshots/${shot.file} (${shot.width}x${shot.height})`);
  }
}

main().catch((err) => {
  console.error("[generate-screenshots] failed:", err);
  process.exit(1);
});

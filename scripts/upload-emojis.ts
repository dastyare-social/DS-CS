#!/usr/bin/env tsx
import "dotenv/config";
/**
 * Download animated emojis from GitHub repo, compress with sharp, upload to S3.
 *
 * Usage:
 *   bun run upload:emojis          # upload all emojis
 *   bun run upload:emojis --check  # check if emojis exist on S3 (no upload)
 *
 * Env vars required:
 *   S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY,
 *   S3_BUCKET_NAME, S3_FORCE_PATH_STYLE, S3_PUBLIC_BASE_URL (optional)
 *
 * The emojis are fetched from https://github.com/dastyare-social/animated-emojis
 * compressed to ~12KB each with sharp, and uploaded under the key prefix
 * "animated-emojies/" on S3.
 */

import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";

const GITHUB_REPO = "dastyare-social/animated-emojis";
const GITHUB_RAW = `https://raw.githubusercontent.com/${GITHUB_REPO}/main`;
const S3_PREFIX = "animated-emojies";
const QUALITY = 80;

function getS3Client(): S3Client {
  return new S3Client({
    region: process.env.S3_REGION || "us-east-1",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
    },
  });
}

function buildPublicUrl(key: string): string {
  if (process.env.S3_PUBLIC_BASE_URL) {
    return `${process.env.S3_PUBLIC_BASE_URL.replace(/\/+$/, "")}/${key}`;
  }
  const endpoint = process.env.S3_ENDPOINT || "";
  const bucket = process.env.S3_BUCKET_NAME || "";
  return `${endpoint.replace(/\/+$/, "")}/${bucket}/${key}`;
}

async function getFileList(): Promise<string[]> {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/git/trees/main`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch repo tree: ${res.status}`);
  const data = (await res.json()) as { tree: { path: string }[] };
  return data.tree
    .map((f) => f.path)
    .filter((p) => p.endsWith(".webp") && !p.includes("/"));
}

async function downloadFile(filename: string, dest: string): Promise<void> {
  const url = `${GITHUB_RAW}/${encodeURIComponent(filename)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${filename}: ${res.status}`);
  const body = Readable.fromWeb(res.body as any);
  await pipeline(body, createWriteStream(dest));
}

async function compressWebp(inputPath: string): Promise<Buffer> {
  const buf = fs.readFileSync(inputPath);
  return sharp(buf).webp({ quality: QUALITY }).toBuffer();
}

async function checkEmojiExists(
  client: S3Client,
  key: string
): Promise<boolean> {
  try {
    await client.send(new HeadObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const checkOnly = process.argv.includes("--check");

  if (!process.env.S3_ENDPOINT && !process.env.S3_ACCESS_KEY_ID) {
    console.error("Missing S3 env vars. Set S3_ENDPOINT and S3_ACCESS_KEY_ID.");
    process.exit(1);
  }

  const client = getS3Client();
  const bucket = process.env.S3_BUCKET_NAME!;

  console.log("Fetching emoji list from GitHub...");
  const files = await getFileList();
  console.log(`Found ${files.length} emojis`);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "emojis-"));
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const key = `${S3_PREFIX}/${filename}`;
    const pct = ((i + 1) / files.length * 100).toFixed(0);

    if (checkOnly) {
      const exists = await checkEmojiExists(client, key);
      if (!exists) {
        console.log(`  [${pct}%] MISSING: ${filename}`);
        failed++;
      }
      continue;
    }

    try {
      const exists = await checkEmojiExists(client, key);
      if (exists) {
        skipped++;
        continue;
      }

      const tmpPath = path.join(tmpDir, filename);
      await downloadFile(filename, tmpPath);
      const compressed = await compressWebp(tmpPath);

      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: compressed,
          ContentType: "image/webp",
          CacheControl: "public, max-age=31536000, immutable",
        })
      );

      uploaded++;
      if (uploaded % 50 === 0 || uploaded === files.length) {
        console.log(`  [${pct}%] Uploaded ${uploaded}/${files.length}`);
      }
    } catch (err: any) {
      console.error(`  FAILED: ${filename} - ${err.message}`);
      failed++;
    }
  }

  // Cleanup tmp
  fs.rmSync(tmpDir, { recursive: true, force: true });

  if (checkOnly) {
    console.log(`\nCheck complete: ${failed} missing out of ${files.length}`);
    if (failed > 0) process.exit(1);
    console.log("All emojis present on S3.");
  } else {
    console.log(`\nDone! Uploaded: ${uploaded}, Skipped (existing): ${skipped}, Failed: ${failed}`);
    if (uploaded > 0) {
      console.log(`\nPublic base URL: ${buildPublicUrl(S3_PREFIX + "/")}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

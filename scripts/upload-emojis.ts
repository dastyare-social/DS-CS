#!/usr/bin/env tsx
import "dotenv/config";
/**
 * Download animated emojis from Telegram-Animated-Emojis GitHub repo and
 * upload them directly to S3. No compression — original animated .webp files
 * are preserved as-is.
 *
 * Usage:
 *   bun run upload:emojis          # upload all emojis
 *   bun run upload:emojis --check  # check if emojis exist on S3 (no upload)
 *
 * Env vars required:
 *   S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY,
 *   S3_BUCKET_NAME, S3_FORCE_PATH_STYLE, S3_PUBLIC_BASE_URL (optional)
 *
 * The emojis are fetched from https://github.com/omidshabab/Telegram-Animated-Emojis
 * and uploaded under the key prefix "animated-emojies/" on S3.
 */

import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

const GITHUB_REPO = "omidshabab/Telegram-Animated-Emojis";
const GITHUB_RAW = `https://raw.githubusercontent.com/${GITHUB_REPO}/main`;
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/git/trees/main?recursive=1`;
const S3_PREFIX = "animated-emojies";

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

interface TreeEntry {
  path: string;
  type: string;
}

async function getWebpFiles(): Promise<TreeEntry[]> {
  const res = await fetch(GITHUB_API);
  if (!res.ok) throw new Error(`Failed to fetch repo tree: ${res.status}`);
  const data = (await res.json()) as { tree: TreeEntry[]; truncated: boolean };
  if (data.truncated) {
    console.warn(
      "WARNING: GitHub tree response was truncated — some emojis may be missing",
    );
  }
  return data.tree.filter(
    (entry) => entry.type === "blob" && entry.path.endsWith(".webp"),
  );
}

async function checkEmojiExists(
  client: S3Client,
  key: string,
): Promise<boolean> {
  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

async function downloadToS3(
  client: S3Client,
  bucket: string,
  key: string,
  sourceUrl: string,
): Promise<void> {
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${sourceUrl}`);
  const buffer = Buffer.from(await res.arrayBuffer());

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
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
  const files = await getWebpFiles();
  console.log(`Found ${files.length} emojis`);

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < files.length; i++) {
    const entry = files[i];
    const s3Key = `${S3_PREFIX}/${entry.path}`;
    const pct = (((i + 1) / files.length) * 100).toFixed(0);
    const githubUrl = `${GITHUB_RAW}/${entry.path.split("/").map(encodeURIComponent).join("/")}`;

    if (checkOnly) {
      const exists = await checkEmojiExists(client, s3Key);
      if (!exists) {
        console.log(`  [${pct}%] MISSING: ${entry.path}`);
        failed++;
      }
      continue;
    }

    try {
      const exists = await checkEmojiExists(client, s3Key);
      if (exists) {
        skipped++;
        continue;
      }

      await downloadToS3(client, bucket, s3Key, githubUrl);
      uploaded++;
      if (uploaded % 50 === 0 || i === files.length - 1) {
        console.log(
          `  [${pct}%] Uploaded ${uploaded}, Skipped ${skipped}, Failed ${failed}`,
        );
      }
    } catch (err: any) {
      console.error(`  FAILED: ${entry.path} - ${err.message}`);
      failed++;
    }
  }

  if (checkOnly) {
    console.log(`\nCheck complete: ${failed} missing out of ${files.length}`);
    if (failed > 0) process.exit(1);
    console.log("All emojis present on S3.");
  } else {
    console.log(
      `\nDone! Uploaded: ${uploaded}, Skipped (existing): ${skipped}, Failed: ${failed}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

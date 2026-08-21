#!/usr/bin/env tsx
import "dotenv/config";

// Skip on local builds — only run on CI/server where CI env var is set.
if (!process.env.CI) {
  console.log("Skipping upload:emojis (not on CI)");
  process.exit(0);
}

/**
 * Download animated emojis from Telegram-Animated-Emojis GitHub repo and
 * upload them directly to S3. No compression — original animated .webp files
 * are preserved as-is.
 *
 * On every run, the animated-emojies/ prefix on S3 is cleared first,
 * then all emojis are uploaded fresh.
 *
 * Usage:
 *   bun run upload:emojis          # clear + upload all emojis
 *   bun run upload:emojis --check  # check if emojis exist on S3 (no upload)
 *
 * Env vars required:
 *   S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY,
 *   S3_BUCKET_NAME, S3_FORCE_PATH_STYLE, S3_PUBLIC_BASE_URL (optional)
 */

import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import path from "node:path";

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

async function getWebpFiles(): Promise<{ sourcePath: string; name: string }[]> {
  const res = await fetch(GITHUB_API);
  if (!res.ok) throw new Error(`Failed to fetch repo tree: ${res.status}`);
  const data = (await res.json()) as { tree: TreeEntry[]; truncated: boolean };
  if (data.truncated) {
    console.warn("WARNING: GitHub tree response was truncated — some emojis may be missing");
  }
  return data.tree
    .filter((e) => e.type === "blob" && e.path.endsWith(".webp"))
    .map((e) => ({ sourcePath: e.path, name: path.basename(e.path) }));
}

async function clearS3Prefix(client: S3Client, bucket: string): Promise<number> {
  let deleted = 0;
  let continuationToken: string | undefined;

  do {
    const list = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: `${S3_PREFIX}/`,
        ContinuationToken: continuationToken,
      }),
    );

    const objects = list.Contents;
    if (!objects || objects.length === 0) break;

    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: objects.map((o) => ({ Key: o.Key! })),
        },
      }),
    );

    deleted += objects.length;
    continuationToken = list.NextContinuationToken;
  } while (continuationToken);

  return deleted;
}

async function checkEmojiExists(client: S3Client, key: string): Promise<boolean> {
  try {
    await client.send(
      new HeadObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: key }),
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

  if (checkOnly) {
    let missing = 0;
    for (const file of files) {
      const exists = await checkEmojiExists(client, `${S3_PREFIX}/${file.name}`);
      if (!exists) {
        console.log(`  MISSING: ${file.name}`);
        missing++;
      }
    }
    console.log(`\nCheck complete: ${missing} missing out of ${files.length}`);
    if (missing > 0) process.exit(1);
    console.log("All emojis present on S3.");
    return;
  }

  // Clear existing emojis on S3
  console.log("Clearing animated-emojies/ on S3...");
  const deleted = await clearS3Prefix(client, bucket);
  console.log(`Deleted ${deleted} old emojis`);

  // Upload all emojis fresh
  let uploaded = 0;
  let failed = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const s3Key = `${S3_PREFIX}/${file.name}`;
    const pct = (((i + 1) / files.length) * 100).toFixed(0);
    const githubUrl = `${GITHUB_RAW}/${file.sourcePath.split("/").map(encodeURIComponent).join("/")}`;

    try {
      await downloadToS3(client, bucket, s3Key, githubUrl);
      uploaded++;
    } catch (err: any) {
      console.error(`  FAILED: ${file.name} - ${err.message}`);
      failed++;
    }

    if ((i + 1) % 50 === 0 || i === files.length - 1) {
      console.log(`  [${pct}%] Uploaded ${uploaded}, Failed ${failed}`);
    }
  }

  console.log(`\nDone! Uploaded: ${uploaded}, Failed: ${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

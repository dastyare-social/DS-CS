import { randomUUID } from "crypto";
import { Readable } from "stream";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Upload } from "@aws-sdk/lib-storage";
import { S3_BUCKET, buildPublicFileUrl, getS3Client } from "./s3";
import { MediaValidationError, classifyMediaType, mediaConfig, validateFile } from "./config";
import type { MediaKind } from "./config";
import { getMediaDimensions } from "@/lib/utils/media";
import { assertWritable } from "@/lib/demo-mode";

export interface UploadedMedia {
  url: string;
  key: string;
  kind: MediaKind;
  mimeType: string;
  size: number;
  width: number;
  height: number;
  duration: number;
  filename: string;
}

function safeExtension(mimeType: string): string {
  const ext = mimeType.split("/")[1]?.split(";")[0]?.split("+")[0]?.trim();
  if (!ext || !/^[a-z0-9]+$/i.test(ext)) return "bin";
  return ext.toLowerCase();
}

export async function uploadFileToS3(file: File): Promise<UploadedMedia> {
  assertWritable();
  const kind = validateFile(file);

  const mimeType = (file.type || "application/octet-stream").toLowerCase();
  const key = `${mediaConfig().keyPrefix}/${kind}/${randomUUID()}.${safeExtension(mimeType)}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: S3_BUCKET(),
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    })
  );

  const dimensions = await getMediaDimensions(buffer, mimeType);

  return {
    url: buildPublicFileUrl(key),
    key,
    kind,
    mimeType,
    size: file.size,
    width: dimensions.width,
    height: dimensions.height,
    duration: dimensions.duration ?? 0,
    filename: file.name || key.split("/").pop() || key,
  };
}

export async function uploadFilesToS3(files: File[]): Promise<UploadedMedia[]> {
  return Promise.all(files.map((file) => uploadFileToS3(file)));
}

export async function uploadFileToS3Stream(
  file: File,
  onProgress: (percent: number) => void,
): Promise<UploadedMedia> {
  assertWritable();
  const kind = validateFile(file);

  const mimeType = (file.type || "application/octet-stream").toLowerCase();
  const key = `${mediaConfig().keyPrefix}/${kind}/${randomUUID()}.${safeExtension(mimeType)}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const totalSize = buffer.length;
  let uploadedBytes = 0;
  let offset = 0;

  const readable = new Readable({
    read() {
      if (offset >= totalSize) {
        this.push(null);
        return;
      }
      const chunkSize = Math.min(256 * 1024, totalSize - offset);
      const chunk = buffer.subarray(offset, offset + chunkSize);
      offset += chunkSize;
      uploadedBytes += chunkSize;
      onProgress(Math.round((uploadedBytes / totalSize) * 100));
      this.push(chunk);
    },
  });

  const upload = new Upload({
    client: getS3Client(),
    params: {
      Bucket: S3_BUCKET(),
      Key: key,
      Body: readable,
      ContentType: mimeType,
      ContentLength: totalSize,
    },
    queueSize: 4,
    partSize: 5 * 1024 * 1024,
  });

  await upload.done();

  const dimensions = await getMediaDimensions(buffer, mimeType);

  return {
    url: buildPublicFileUrl(key),
    key,
    kind,
    mimeType,
    size: file.size,
    width: dimensions.width,
    height: dimensions.height,
    duration: dimensions.duration ?? 0,
    filename: file.name || key.split("/").pop() || key,
  };
}

export { MediaValidationError, classifyMediaType };

export interface PresignResult {
  uploadUrl: string;
  key: string;
  kind: MediaKind;
  mimeType: string;
}

export async function presignUpload(
  file: File,
): Promise<PresignResult> {
  assertWritable();
  const kind = validateFile(file);

  const mimeType = (file.type || "application/octet-stream").toLowerCase();
  const key = `${mediaConfig().keyPrefix}/${kind}/${randomUUID()}.${safeExtension(mimeType)}`;

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET(),
    Key: key,
    ContentType: mimeType,
  });

  const uploadUrl = await getSignedUrl(getS3Client(), command, {
    expiresIn: 3600,
  });

  return { uploadUrl, key, kind, mimeType };
}

export async function confirmUpload(key: string): Promise<UploadedMedia> {
  const parts = key.split("/");
  const kind = classifyMediaType(key);
  const mimeType = parts[2] || "application/octet-stream";

  return {
    url: buildPublicFileUrl(key),
    key,
    kind,
    mimeType,
    size: 0,
    width: 0,
    height: 0,
    duration: 0,
    filename: key.split("/").pop() || key,
  };
}

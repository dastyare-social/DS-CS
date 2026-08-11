import { randomUUID } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { S3_BUCKET, buildPublicFileUrl, getS3Client } from "./s3";
import { MediaValidationError, classifyMediaType, mediaConfig, validateFile } from "./config";
import type { MediaKind } from "./config";
import { getMediaDimensions } from "@/lib/utils/media";

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

export { MediaValidationError, classifyMediaType };

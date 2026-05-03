import {
  CopyObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

const allowedImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function getBucket() {
  const bucket = process.env.AWS_S3_BUCKET;

  if (!bucket) {
    throw new Error("AWS_S3_BUCKET must be configured for photo uploads.");
  }

  return bucket;
}

function getS3Client() {
  const region = process.env.AWS_REGION ?? "us-west-2";
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  return new S3Client({
    region,
    credentials:
      accessKeyId && secretAccessKey
        ? {
            accessKeyId,
            secretAccessKey,
          }
        : undefined,
  });
}

function cleanFileName(fileName: string) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function isAllowedImageType(contentType: string) {
  return allowedImageTypes.has(contentType);
}

export function approvedKeyFromPendingKey(key: string) {
  return key.startsWith("pending/")
    ? key.replace(/^pending\//, "approved/")
    : `approved/${key}`;
}

export async function createPendingPhotoUpload(
  fileName: string,
  contentType: string,
) {
  if (!isAllowedImageType(contentType)) {
    throw new Error("Unsupported image type.");
  }

  const key = `pending/${randomUUID()}-${cleanFileName(fileName) || "photo"}`;
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    ContentType: contentType,
  });

  return {
    key,
    uploadUrl: await getSignedUrl(getS3Client(), command, { expiresIn: 300 }),
  };
}

export async function copyPendingPhotoToApproved(key: string) {
  const approvedKey = approvedKeyFromPendingKey(key);
  const bucket = getBucket();
  const copySource = `${bucket}/${encodeURIComponent(key).replace(/%2F/g, "/")}`;

  await getS3Client().send(
    new CopyObjectCommand({
      Bucket: bucket,
      CopySource: copySource,
      Key: approvedKey,
    }),
  );

  return approvedKey;
}

export async function getPhotoReadUrl(key: string) {
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: key,
  });

  return getSignedUrl(getS3Client(), command, { expiresIn: 300 });
}

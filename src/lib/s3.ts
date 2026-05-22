import { marketplaceListingImageKeyPrefix } from "@/lib/marketplaceListingImage";
import {
  isAllowedImageType,
  isAllowedPhotoSize,
  photoUploadLimitLabel,
} from "@/lib/photoUpload";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

function getBucket() {
  const bucket = process.env.AWS_S3_BUCKET;

  if (!bucket) {
    throw new Error("AWS_S3_BUCKET must be configured for photo uploads.");
  }

  return bucket;
}

function getS3Client() {
  const region = process.env.AWS_REGION ?? "us-west-1";
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  return new S3Client({
    region,
    requestChecksumCalculation: "WHEN_REQUIRED",
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

export function approvedKeyFromPendingKey(key: string) {
  return key.startsWith("pending/")
    ? key.replace(/^pending\//, "approved/")
    : `approved/${key}`;
}

async function movePhotoObject(sourceKey: string, destinationKey: string) {
  const bucket = getBucket();
  const client = getS3Client();
  const copySource = `${bucket}/${encodeURIComponent(sourceKey).replace(/%2F/g, "/")}`;

  await client.send(
    new CopyObjectCommand({
      Bucket: bucket,
      CopySource: copySource,
      Key: destinationKey,
    }),
  );
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: sourceKey,
    }),
  );

  return destinationKey;
}

async function createPhotoUpload(
  fileName: string,
  contentType: string,
  fileSize: number,
  prefix: string,
) {
  if (!isAllowedImageType(contentType)) {
    throw new Error("Unsupported image type.");
  }

  if (!isAllowedPhotoSize(fileSize)) {
    throw new Error(`Photos must be ${photoUploadLimitLabel} or smaller.`);
  }

  const key = `${prefix}/${randomUUID()}-${cleanFileName(fileName) || "photo"}`;
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

export async function createPendingPhotoUpload(
  fileName: string,
  contentType: string,
  fileSize: number,
) {
  return createPhotoUpload(fileName, contentType, fileSize, "pending");
}

export async function createRemembrancePhotoUpload(
  fileName: string,
  contentType: string,
  fileSize: number,
) {
  return createPhotoUpload(fileName, contentType, fileSize, "remembrance");
}

export async function uploadMarketplaceListingImageObject(
  fileName: string,
  contentType: string,
  fileSize: number,
  body: Uint8Array,
) {
  if (!isAllowedImageType(contentType)) {
    throw new Error("Unsupported image type.");
  }

  if (!isAllowedPhotoSize(fileSize)) {
    throw new Error(`Photos must be ${photoUploadLimitLabel} or smaller.`);
  }

  const key = `${marketplaceListingImageKeyPrefix}/${randomUUID()}-${cleanFileName(fileName) || "listing-image"}`;

  await getS3Client().send(
    new PutObjectCommand({
      Body: body,
      Bucket: getBucket(),
      ContentType: contentType,
      Key: key,
    }),
  );

  return {
    key,
  };
}

export async function movePendingPhotoToApproved(key: string) {
  return movePhotoObject(key, approvedKeyFromPendingKey(key));
}

export async function moveApprovedPhotoToPending(
  approvedKey: string,
  pendingKey: string,
) {
  return movePhotoObject(approvedKey, pendingKey);
}

export async function deletePhotoObject(key: string) {
  await getS3Client().send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: key,
    }),
  );
}

export async function getPhotoReadUrl(key: string) {
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: key,
  });

  return getSignedUrl(getS3Client(), command, { expiresIn: 300 });
}

export async function getPhotoObjectBytes(key: string) {
  const response = await getS3Client().send(
    new GetObjectCommand({
      Bucket: getBucket(),
      Key: key,
    }),
  );

  if (!response.Body) {
    throw new Error("Photo object body is missing.");
  }

  const body = Buffer.from(await response.Body.transformToByteArray());

  return {
    body,
    contentLength: response.ContentLength ?? body.byteLength,
    contentType: response.ContentType ?? "application/octet-stream",
  };
}

import { db } from "@/lib/db";
import { buildPaginationState, type PaginationParams } from "@/lib/pagination";
import { getPhotoObjectBytes } from "@/lib/s3";
import {
  chairPhotoListOrderBy,
  chairPhotoReviewInclude,
  chairRemembranceDownloadSelect,
  type ChairPhotoListPageOptions,
  type ChairRemembranceDownloadPhoto,
  type PaginatedChairPhotoResult,
} from "@/lib/type";
import { type PhotoPurpose, type Prisma } from "@prisma/client";
import { zipSync } from "fflate";
import { basename, extname } from "node:path";

const uuidFilePrefixPattern =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}-/i;

export const REMEMBRANCE_ZIP_FILE_NAME = "blarney-remembrance.zip";
export const REMEMBRANCE_ZIP_FOLDER_NAME = "blarney-remembrance";

export type { ChairRemembranceDownloadPhoto } from "@/lib/type";

async function listChairPhotosByPurpose(purpose: PhotoPurpose) {
  try {
    return await db.photoSubmission.findMany({
      where: { purpose },
      include: chairPhotoReviewInclude,
      orderBy: chairPhotoListOrderBy,
    });
  } catch {
    return [];
  }
}

async function listChairPhotosPage({
  pagination,
  purpose,
  where,
}: ChairPhotoListPageOptions): Promise<PaginatedChairPhotoResult> {
  const photoWhere: Prisma.PhotoSubmissionWhereInput = {
    purpose,
    ...where,
  };

  try {
    const [photos, totalCount] = await Promise.all([
      db.photoSubmission.findMany({
        where: photoWhere,
        include: chairPhotoReviewInclude,
        orderBy: chairPhotoListOrderBy,
        skip: pagination.skip,
        take: pagination.take,
      }),
      db.photoSubmission.count({ where: photoWhere }),
    ]);

    return {
      photos,
      pagination: buildPaginationState(pagination, totalCount),
    };
  } catch {
    return {
      photos: [],
      pagination: buildPaginationState(pagination, 0),
    };
  }
}

export function listChairGalleryPhotos() {
  return listChairPhotosByPurpose("GALLERY");
}

export function listChairRemembrancePhotos() {
  return listChairPhotosByPurpose("REMEMBRANCE");
}

export function listPendingChairGalleryPhotosPage(
  pagination: PaginationParams,
  where?: Prisma.PhotoSubmissionWhereInput,
) {
  return listChairPhotosPage({
    pagination,
    purpose: "GALLERY",
    where: { status: "PENDING", ...where },
  });
}

export function listReviewedChairGalleryPhotosPage(
  pagination: PaginationParams,
  where?: Prisma.PhotoSubmissionWhereInput,
) {
  return listChairPhotosPage({
    pagination,
    purpose: "GALLERY",
    where: { status: "APPROVED", ...where },
  });
}

export function listChairRemembrancePhotosPage(pagination: PaginationParams) {
  return listChairPhotosPage({
    pagination,
    purpose: "REMEMBRANCE",
  });
}

export async function findChairRemembrancePhotoForDownload(id: string) {
  return db.photoSubmission.findFirst({
    where: {
      id,
      purpose: "REMEMBRANCE",
    },
    select: chairRemembranceDownloadSelect,
  });
}

export async function listChairRemembrancePhotosForDownload(ids?: string[]) {
  return db.photoSubmission.findMany({
    where: {
      purpose: "REMEMBRANCE",
      ...(ids ? { id: { in: ids } } : {}),
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: chairRemembranceDownloadSelect,
  });
}

export function getChairRemembrancePhotoObjectKey(
  photo: ChairRemembranceDownloadPhoto,
) {
  return photo.approvedS3Key ?? photo.s3Key;
}

function cleanDownloadSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function buildChairRemembranceDownloadFileName(
  photo: ChairRemembranceDownloadPhoto,
  usedNames = new Set<string>(),
) {
  const sourceKey = getChairRemembrancePhotoObjectKey(photo);
  const extension = extname(sourceKey).toLowerCase();
  const keyBase = basename(sourceKey, extension).replace(
    uuidFilePrefixPattern,
    "",
  );
  const preferredBase = cleanDownloadSegment(photo.caption ?? keyBase);
  const fallbackBase = cleanDownloadSegment(`remembrance-${photo.id}`);
  const baseName = preferredBase || fallbackBase;

  let fileName = `${baseName}${extension}`;
  let suffix = 2;

  while (usedNames.has(fileName)) {
    fileName = `${baseName}-${suffix}${extension}`;
    suffix += 1;
  }

  usedNames.add(fileName);

  return fileName;
}

export async function buildChairRemembranceArchive(
  photos: ChairRemembranceDownloadPhoto[],
) {
  const usedNames = new Set<string>();
  const archiveEntries: Record<string, Uint8Array> = {};

  for (const photo of photos) {
    const fileName = buildChairRemembranceDownloadFileName(photo, usedNames);
    const object = await getPhotoObjectBytes(
      getChairRemembrancePhotoObjectKey(photo),
    );

    archiveEntries[`${REMEMBRANCE_ZIP_FOLDER_NAME}/${fileName}`] = object.body;
  }

  return Buffer.from(zipSync(archiveEntries));
}

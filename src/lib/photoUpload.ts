export const maxPhotoUploadMegabytes = 25;
export const maxPhotoUploadBytes = maxPhotoUploadMegabytes * 1024 * 1024;
export const photoUploadLimitLabel = `${maxPhotoUploadMegabytes} MB`;

const acceptedPhotoContentTypeList = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export const acceptedPhotoContentTypes = acceptedPhotoContentTypeList.join(",");

const allowedImageTypes = new Set<string>(acceptedPhotoContentTypeList);

export function isAllowedImageType(contentType: string) {
  return allowedImageTypes.has(contentType);
}

export const photoContentHashPattern = /^[0-9a-f]{64}$/;

export function isAllowedPhotoSize(fileSize: number) {
  return (
    Number.isInteger(fileSize) &&
    fileSize > 0 &&
    fileSize <= maxPhotoUploadBytes
  );
}

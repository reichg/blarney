// Extracts the server-suggested file name from a Content-Disposition header,
// falling back when the header is missing or has no parseable filename.
export function getAttachmentFileName(
  contentDisposition: string | null,
  fallbackFileName: string,
) {
  if (!contentDisposition) {
    return fallbackFileName;
  }

  const match = /filename="?([^";]+)"?/i.exec(contentDisposition);

  return match?.[1] ?? fallbackFileName;
}

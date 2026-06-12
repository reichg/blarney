"use client";

import { getAttachmentFileName } from "@/app/chair/download";
import { useChairActionToast } from "@/app/chair/notices/ChairActionToast";
import { type ExportCsvButtonProps } from "@/app/chair/registrations/type";
import { useState } from "react";

// Replaces a plain download anchor so chairs get pending state and an
// explicit success/failure toast instead of a silent failed navigation.
export function ExportCsvButton({
  href,
  fallbackFileName,
  className,
  children,
}: ExportCsvButtonProps) {
  const { showToast } = useChairActionToast();
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport() {
    setIsExporting(true);

    try {
      // Exports are always same-app relative paths; anything else (absolute
      // URL, protocol-relative `//`) is a programming error, not a fetch.
      if (!href.startsWith("/") || href.startsWith("//")) {
        throw new Error("CSV export href must be a same-app relative path.");
      }

      const response = await fetch(href);

      // A redirected or HTML response means the chair session expired and the
      // middleware served the login page; saving that as a .csv would look
      // like a successful export.
      if (
        !response.ok ||
        response.redirected ||
        response.headers.get("content-type")?.includes("text/html")
      ) {
        throw new Error("CSV export failed.");
      }

      const blob = await response.blob();
      const fileName = getAttachmentFileName(
        response.headers.get("content-disposition"),
        fallbackFileName,
      );
      const objectUrl = URL.createObjectURL(blob);
      const downloadLink = document.createElement("a");

      downloadLink.href = objectUrl;
      downloadLink.download = fileName;
      document.body.append(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      URL.revokeObjectURL(objectUrl);
      showToast({ tone: "success", title: "CSV downloaded" });
    } catch {
      showToast({
        tone: "error",
        title: "Export failed",
        body: "Try again.",
      });
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <button
      className={className}
      disabled={isExporting}
      onClick={handleExport}
      type="button"
    >
      {isExporting ? "Exporting…" : children}
    </button>
  );
}

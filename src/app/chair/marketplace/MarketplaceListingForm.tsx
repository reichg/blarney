"use client";

import styles from "@/app/chair/chair.module.css";
import { MarketplaceListingImageField } from "@/app/chair/marketplace/MarketplaceListingImageField";
import { uploadMarketplaceListingImage } from "@/lib/marketplaceListingImageClient";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

type MarketplaceListingFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  fieldId: string;
  initialImageValue?: string | null;
  pendingSubmitLabel: string;
  submitLabel: string;
  uploadPendingLabel: string;
};

function getDefaultStatusMessage(currentValue: string) {
  return currentValue
    ? "Current saved image stays linked until you save a replacement or remove it."
    : "No listing image selected yet.";
}

function getSelectedFileMessage(fileName: string, currentValue: string) {
  return currentValue
    ? `${fileName} selected. Save listing to upload the replacement and apply it.`
    : `${fileName} selected. Save listing to upload and apply it.`;
}

function MarketplaceListingSubmitButton({
  isUploading,
  pendingSubmitLabel,
  submitLabel,
  uploadPendingLabel,
}: {
  isUploading: boolean;
  pendingSubmitLabel: string;
  submitLabel: string;
  uploadPendingLabel: string;
}) {
  const { pending } = useFormStatus();
  const isPending = pending || isUploading;

  return (
    <button
      className={`${styles.actionButton} ${styles.fullWidthButton}`}
      disabled={isPending}
      type="submit"
    >
      {isUploading
        ? uploadPendingLabel
        : pending
          ? pendingSubmitLabel
          : submitLabel}
    </button>
  );
}

export function MarketplaceListingForm({
  action,
  children,
  fieldId,
  initialImageValue = null,
  pendingSubmitLabel,
  submitLabel,
  uploadPendingLabel,
}: MarketplaceListingFormProps) {
  const hiddenImageInputRef = useRef<HTMLInputElement>(null);
  const skipSubmitInterceptionRef = useRef(false);
  const [currentImageValue, setCurrentImageValue] = useState(
    initialImageValue ?? "",
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [statusMessage, setStatusMessage] = useState(
    getDefaultStatusMessage(initialImageValue ?? ""),
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  function setHiddenImageValue(nextValue: string) {
    if (hiddenImageInputRef.current) {
      hiddenImageInputRef.current.value = nextValue;
    }

    setCurrentImageValue(nextValue);
  }

  function handleFileChange(file: File | null) {
    setSelectedFile(file);
    setErrorMessage(null);
    setStatusMessage(
      file
        ? getSelectedFileMessage(file.name, currentImageValue)
        : getDefaultStatusMessage(currentImageValue),
    );
  }

  function handleRemoveImage() {
    setSelectedFile(null);
    setHiddenImageValue("");
    setErrorMessage(null);
    setStatusMessage(
      "Listing image will be removed when you save the listing.",
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (skipSubmitInterceptionRef.current) {
      skipSubmitInterceptionRef.current = false;
      return;
    }

    if (!selectedFile || isUploading) {
      return;
    }

    event.preventDefault();

    const form = event.currentTarget;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const pendingFile = selectedFile;

    setErrorMessage(null);
    setIsUploading(true);
    setStatusMessage(`Uploading ${pendingFile.name} and saving the listing...`);

    try {
      const upload = await uploadMarketplaceListingImage(pendingFile);

      setHiddenImageValue(upload.imageKey);
      setSelectedFile(null);
      setStatusMessage("Listing image uploaded. Saving the listing...");
      skipSubmitInterceptionRef.current = true;

      if (
        submitter instanceof HTMLButtonElement ||
        submitter instanceof HTMLInputElement
      ) {
        form.requestSubmit(submitter);
      } else {
        form.requestSubmit();
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Listing image upload failed.",
      );
      setStatusMessage(
        getSelectedFileMessage(pendingFile.name, currentImageValue),
      );
      setIsUploading(false);
    }
  }

  return (
    <form
      action={action}
      className={styles.compactForm}
      onSubmit={handleSubmit}
    >
      {children}
      <input
        defaultValue={currentImageValue}
        name="imageUrl"
        ref={hiddenImageInputRef}
        type="hidden"
      />
      <MarketplaceListingImageField
        currentValue={currentImageValue}
        errorMessage={errorMessage}
        fieldId={fieldId}
        isSaving={isUploading}
        onFileChange={handleFileChange}
        onRemove={handleRemoveImage}
        selectedFile={selectedFile}
        statusMessage={statusMessage}
      />
      <MarketplaceListingSubmitButton
        isUploading={isUploading}
        pendingSubmitLabel={pendingSubmitLabel}
        submitLabel={submitLabel}
        uploadPendingLabel={uploadPendingLabel}
      />
    </form>
  );
}

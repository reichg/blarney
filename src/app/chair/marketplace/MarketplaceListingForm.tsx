"use client";

import styles from "@/app/chair/chair.module.css";
import { MarketplaceListingImageField } from "@/app/chair/marketplace/MarketplaceListingImageField";
import {
  useMarketplaceActionNavigation,
  type MarketplaceFormAction,
} from "@/app/chair/marketplace/useMarketplaceActionNavigation";
import { usePreviewDetailCardClose } from "@/app/chair/PreviewDetailCardContext";
import { DraftNotice } from "@/components/DraftNotice";
import { uploadMarketplaceListingImage } from "@/lib/marketplaceListingImageClient";
import { useUncontrolledFormDraft } from "@/lib/useFormDraft";
import { useCallback, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

/** sessionStorage key for the chair create-listing draft. Stable across mounts. */
const CREATE_LISTING_DRAFT_FORM_ID = "chairCreateListing";
const CREATE_LISTING_DRAFT_VERSION = 1;
/** S3 key input is type=hidden (auto-excluded); listed for clarity. */
const CREATE_LISTING_DRAFT_EXCLUDE = ["imageUrl"] as const;

type MarketplaceListingFormProps = {
  action: MarketplaceFormAction;
  children: ReactNode;
  // Enables same-tab sessionStorage draft persistence. Create-form only: edit
  // forms must not restore a stale draft over server-loaded listing data.
  enableDraftPersistence?: boolean;
  fieldId: string;
  initialImageValue?: string | null;
  pendingSubmitLabel: string;
  secondaryChildren?: ReactNode;
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
  enableDraftPersistence = false,
  fieldId,
  initialImageValue = null,
  pendingSubmitLabel,
  secondaryChildren = null,
  submitLabel,
  uploadPendingLabel,
}: MarketplaceListingFormProps) {
  const runMarketplaceAction = useMarketplaceActionNavigation();
  const closePreviewDetailCard = usePreviewDetailCardClose();
  const formRef = useRef<HTMLFormElement>(null);
  const { wasRestored, clearDraft, handleChange } = useUncontrolledFormDraft({
    formId: CREATE_LISTING_DRAFT_FORM_ID,
    formVersion: CREATE_LISTING_DRAFT_VERSION,
    formRef,
    excludeFields: CREATE_LISTING_DRAFT_EXCLUDE,
    enabled: enableDraftPersistence,
  });
  const hiddenImageInputRef = useRef<HTMLInputElement>(null);
  const skipSubmitInterceptionRef = useRef(false);
  const [currentImageValue, setCurrentImageValue] = useState(
    initialImageValue ?? "",
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [statusMessage, setStatusMessage] = useState(
    getDefaultStatusMessage(initialImageValue ?? ""),
  );
  const [statusTone, setStatusTone] = useState<"info" | "warning">("info");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Fires only on a successful action (server returned a redirectTo). Clearing
  // the draft here ensures a created listing is not re-restored on next visit.
  const handleActionResult = useCallback(() => {
    clearDraft();
    closePreviewDetailCard();
  }, [clearDraft, closePreviewDetailCard]);

  function setHiddenImageValue(nextValue: string) {
    if (hiddenImageInputRef.current) {
      hiddenImageInputRef.current.value = nextValue;
    }

    setCurrentImageValue(nextValue);
  }

  function handleFileChange(file: File | null) {
    setSelectedFile(file);
    setErrorMessage(null);
    setStatusTone("info");
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
    setStatusTone("warning");
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
    setStatusTone("info");
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
      action={runMarketplaceAction(action, { onResult: handleActionResult })}
      className={styles.compactForm}
      onInput={handleChange}
      onSubmit={handleSubmit}
      ref={formRef}
    >
      <DraftNotice
        onDiscard={() => {
          clearDraft();
          formRef.current?.reset();
        }}
        visible={wasRestored}
      />
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
        statusTone={statusTone}
      />
      {secondaryChildren}
      <MarketplaceListingSubmitButton
        isUploading={isUploading}
        pendingSubmitLabel={pendingSubmitLabel}
        submitLabel={submitLabel}
        uploadPendingLabel={uploadPendingLabel}
      />
    </form>
  );
}

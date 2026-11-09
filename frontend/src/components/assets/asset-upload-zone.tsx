"use client";

import React, { useRef, useState, useCallback } from "react";
import {
  Asset,
  AssetCategory,
  CATEGORY_ALLOWED_FORMATS,
  MAX_ASSET_SIZE_BYTES,
  uploadProjectAsset,
  ApiRequestError,
} from "@/lib/api";
import { formatBytes } from "./asset-formatters";
import { UploadCloudIcon, CloseIcon } from "./asset-icons";

interface AssetUploadZoneProps {
  projectId: string;
  isArchived: boolean;
  getToken: () => Promise<string | null>;
  onSignOut: () => Promise<void>;
  onUploadSuccess: (asset: Asset) => void;
  onUploadAborted?: () => void;
  onCancelZone?: () => void;
}

export function AssetUploadZone({
  projectId,
  isArchived,
  getToken,
  onSignOut,
  onUploadSuccess,
  onUploadAborted,
  onCancelZone,
}: AssetUploadZoneProps) {
  const [category, setCategory] = useState<AssetCategory>("sketch");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [status, setStatus] = useState<
    "idle" | "uploading" | "success" | "error" | "cancelled"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const validateFileForCategory = useCallback(
    (selectedFile: File, selectedCategory: AssetCategory): string | null => {
      if (selectedFile.size > MAX_ASSET_SIZE_BYTES) {
        return `File exceeds the 20 MB limit (${formatBytes(selectedFile.size)}).`;
      }
      const extension = `.${selectedFile.name.split(".").pop()?.toLowerCase() || ""}`;
      const allowedExtensions = CATEGORY_ALLOWED_FORMATS[selectedCategory].extensions;
      if (!allowedExtensions.includes(extension)) {
        return `File type "${extension}" is not allowed for ${CATEGORY_ALLOWED_FORMATS[selectedCategory].label}. Allowed: ${CATEGORY_ALLOWED_FORMATS[selectedCategory].description}.`;
      }
      return null;
    },
    []
  );

  const handleFileSelect = (selectedFile: File) => {
    const error = validateFileForCategory(selectedFile, category);
    if (error) {
      setErrorMessage(error);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setErrorMessage(null);
    setFile(selectedFile);
    setStatus("idle");
    setProgress(null);
  };

  const handleCategoryChange = (newCategory: AssetCategory) => {
    setCategory(newCategory);
    setErrorMessage(null);
    if (file) {
      const error = validateFileForCategory(file, newCategory);
      if (error) {
        setErrorMessage(error);
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isArchived && status !== "uploading") {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (isArchived || status === "uploading") return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      handleFileSelect(droppedFile);
    }
  };

  const handleCancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStatus("cancelled");
    setProgress(null);
    setErrorMessage("Upload was cancelled.");
    onUploadAborted?.();
  };

  const handleStartUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || isArchived || status === "uploading") return;

    const validation = validateFileForCategory(file, category);
    if (validation) {
      setErrorMessage(validation);
      return;
    }

    setStatus("uploading");
    setProgress(0);
    setErrorMessage(null);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const token = await getToken();
      if (!token) {
        await onSignOut();
        return;
      }

      const uploadedAsset = await uploadProjectAsset(
        token,
        projectId,
        file,
        category,
        (percent) => {
          setProgress(percent);
        },
        abortController.signal
      );

      setStatus("success");
      setProgress(100);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onUploadSuccess(uploadedAsset);
    } catch (err: unknown) {
      if (
        (err instanceof DOMException && err.name === "AbortError") ||
        (err instanceof Error && err.name === "AbortError")
      ) {
        setStatus("cancelled");
        setProgress(null);
        setErrorMessage("Upload was cancelled.");
        onUploadAborted?.();
        return;
      }

      if (err instanceof ApiRequestError && err.status === 401) {
        await onSignOut();
        return;
      }

      const message =
        err instanceof Error ? err.message : "Upload failed due to a server error.";
      setStatus("error");
      setProgress(null);
      setErrorMessage(message);
    } finally {
      abortControllerRef.current = null;
    }
  };

  if (isArchived) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5 text-center text-sm text-neutral-500">
        Asset uploads are disabled because this project is archived.
      </div>
    );
  }

  const allowedFormats = CATEGORY_ALLOWED_FORMATS[category];

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-7 shadow-xs">
      <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-neutral-950">
            Upload project asset
          </h3>
          <p className="mt-0.5 text-xs text-neutral-500">
            Sketches, floor plans, reference imagery, or PDF specifications (max 20 MB).
          </p>
        </div>
        {onCancelZone && status !== "uploading" && (
          <button
            type="button"
            onClick={onCancelZone}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Close upload form"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        )}
      </div>

      <form onSubmit={handleStartUpload} className="mt-5 space-y-5" noValidate>
        {/* Category Picker */}
        <div>
          <label className="field-label">Asset category</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                "sketch",
                "floor_plan",
                "reference_image",
                "document",
              ] as AssetCategory[]
            ).map((cat) => {
              const info = CATEGORY_ALLOWED_FORMATS[cat];
              const isSelected = category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleCategoryChange(cat)}
                  disabled={status === "uploading"}
                  className={`flex flex-col items-start rounded-xl border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60 ${
                    isSelected
                      ? "border-brand-600 bg-brand-50/50 ring-1 ring-brand-600"
                      : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50"
                  }`}
                >
                  <span
                    className={`text-xs font-semibold ${
                      isSelected ? "text-brand-900" : "text-neutral-800"
                    }`}
                  >
                    {info.label}
                  </span>
                  <span className="mt-1 text-[11px] text-neutral-500 leading-tight">
                    {info.description.replace(" up to 20 MB", "")}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            Selected: <span className="font-medium text-neutral-800">{allowedFormats.label}</span> — accepts{" "}
            {allowedFormats.description}.
          </p>
        </div>

        {/* Drag and drop zone */}
        <div>
          <label className="field-label">File</label>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => {
              if (status !== "uploading") {
                fileInputRef.current?.click();
              }
            }}
            className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition cursor-pointer ${
              isDragging
                ? "border-brand-500 bg-brand-50"
                : "border-neutral-300 bg-neutral-50/50 hover:border-neutral-400 hover:bg-neutral-50"
            } ${status === "uploading" ? "cursor-not-allowed opacity-75" : ""}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileSelect(e.target.files[0]);
                }
              }}
              accept={allowedFormats.extensions.join(",")}
              disabled={status === "uploading"}
              className="sr-only"
            />

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-neutral-600 shadow-xs border border-neutral-200">
              <UploadCloudIcon className="h-6 w-6 text-brand-600" />
            </div>

            {file ? (
              <div className="mt-3">
                <p className="text-sm font-semibold text-neutral-900 break-all">
                  {file.name}
                </p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {formatBytes(file.size)} • Click or drop another file to replace
                </p>
              </div>
            ) : (
              <div className="mt-3">
                <p className="text-sm font-medium text-neutral-800">
                  <span className="font-semibold text-brand-600">Click to choose a file</span> or drag and drop
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  {allowedFormats.description}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Upload Progress Bar */}
        {status === "uploading" && progress !== null && (
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="flex items-center justify-between text-xs font-medium text-neutral-700">
              <span>Uploading asset...</span>
              <span>{progress}%</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-200">
              <div
                className="h-full bg-brand-600 transition-all duration-150"
                style={{ width: `${progress}%` }}
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>
        )}

        {/* Status alerts */}
        {errorMessage && (
          <div
            className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800"
            role="alert"
          >
            {errorMessage}
          </div>
        )}

        {status === "success" && (
          <div
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800"
            role="status"
          >
            Asset uploaded successfully!
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          {status === "uploading" ? (
            <button
              type="button"
              onClick={handleCancelUpload}
              className="button-secondary text-xs sm:text-sm text-red-700 hover:bg-red-50"
            >
              Cancel upload
            </button>
          ) : (
            <>
              {onCancelZone && (
                <button
                  type="button"
                  onClick={onCancelZone}
                  className="button-secondary text-xs sm:text-sm"
                >
                  Close
                </button>
              )}
              <button
                type="submit"
                disabled={!file}
                className="button-primary text-xs sm:text-sm"
              >
                Upload asset
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}

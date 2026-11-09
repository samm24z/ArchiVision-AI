"use client";

import React, { useEffect } from "react";
import { Asset } from "@/lib/api";
import { formatBytes } from "./asset-formatters";
import { CategoryIcon } from "./asset-icons";

interface AssetDeleteDialogProps {
  asset: Asset | null;
  isOpen: boolean;
  isDeleting: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function AssetDeleteDialog({
  asset,
  isOpen,
  isDeleting,
  error,
  onConfirm,
  onCancel,
}: AssetDeleteDialogProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isDeleting) {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isDeleting, onCancel]);

  if (!isOpen || !asset) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      aria-describedby="delete-dialog-description"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-neutral-950/40 backdrop-blur-xs transition-opacity"
        onClick={() => {
          if (!isDeleting) onCancel();
        }}
        aria-hidden="true"
      />

      {/* Dialog card */}
      <div className="relative w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl transition-all">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700">
            <CategoryIcon category={asset.category} className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="delete-dialog-title"
              className="text-lg font-semibold tracking-tight text-neutral-950"
            >
              Delete project asset?
            </h2>
            <p className="mt-1 text-sm font-medium text-neutral-800 break-all">
              {asset.original_filename}
              <span className="ml-2 text-xs font-normal text-neutral-500">
                ({formatBytes(asset.file_size_bytes)})
              </span>
            </p>
          </div>
        </div>

        <div
          id="delete-dialog-description"
          className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-xs leading-relaxed text-neutral-600"
        >
          <p className="font-medium text-neutral-900">
            Permanent physical object removal:
          </p>
          <p className="mt-1">
            The stored file will be permanently removed from private object
            storage and removed from your active workspace. Corresponding asset
            metadata is soft-deleted for project history and auditing.
          </p>
        </div>

        {error && (
          <div
            className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="button-secondary text-xs sm:text-sm"
          >
            Keep asset
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-red-700 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm transition hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeleting ? "Deleting..." : "Delete asset"}
          </button>
        </div>
      </div>
    </div>
  );
}


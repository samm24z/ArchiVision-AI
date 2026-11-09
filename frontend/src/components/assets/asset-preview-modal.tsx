"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Asset, getAssetSignedUrl } from "@/lib/api";
import { formatBytes, formatAssetDate, getCategoryBadge } from "./asset-formatters";
import { CloseIcon, ExternalLinkIcon, CategoryIcon } from "./asset-icons";

interface AssetPreviewModalProps {
  asset: Asset | null;
  isOpen: boolean;
  onClose: () => void;
  getToken: () => Promise<string | null>;
}

export function AssetPreviewModal({
  asset,
  isOpen,
  onClose,
  getToken,
}: AssetPreviewModalProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSignedUrl = useCallback(async () => {
    if (!asset) return;
    setIsLoadingUrl(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Session expired. Please sign in again.");
      const result = await getAssetSignedUrl(token, asset.id);
      setSignedUrl(result.signed_url);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to generate an authorized preview link."
      );
    } finally {
      setIsLoadingUrl(false);
    }
  }, [asset, getToken]);

  useEffect(() => {
    if (isOpen && asset) {
      void loadSignedUrl();
    } else {
      setSignedUrl(null);
      setError(null);
      setIsLoadingUrl(false);
    }
  }, [isOpen, asset, loadSignedUrl]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !asset) return null;

  const isPdf = asset.mime_type === "application/pdf";
  const badge = getCategoryBadge(asset.category);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-neutral-950/70 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Content */}
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl border border-neutral-200 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 bg-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-800">
              <CategoryIcon category={asset.category} className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="preview-modal-title"
                className="text-base font-semibold tracking-tight text-neutral-950 truncate max-w-md sm:max-w-xl"
                title={asset.original_filename}
              >
                {asset.original_filename}
              </h2>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-500">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${badge.badgeClass}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${badge.dotClass}`} />
                  {badge.label}
                </span>
                <span>•</span>
                <span>{formatBytes(asset.file_size_bytes)}</span>
                {asset.width && asset.height && (
                  <>
                    <span>•</span>
                    <span>
                      {asset.width} × {asset.height} px
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {signedUrl && (
              <a
                href={signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="button-secondary text-xs h-9 px-3 gap-1.5 inline-flex items-center"
                title="Open in new window or download"
              >
                <span>{isPdf ? "Open PDF" : "Full size"}</span>
                <ExternalLinkIcon className="h-3.5 w-3.5 text-neutral-500" />
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              aria-label="Close preview"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content Viewer */}
        <div className="flex-1 overflow-auto bg-neutral-950/5 p-4 flex items-center justify-center min-h-[300px]">
          {isLoadingUrl && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
              <p className="mt-4 text-xs font-medium text-neutral-600">
                Generating authorized 15-minute access token...
              </p>
            </div>
          )}

          {error && !isLoadingUrl && (
            <div className="max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
              <p className="text-sm font-semibold text-red-900">
                Access authorization failed
              </p>
              <p className="mt-2 text-xs text-neutral-600">{error}</p>
              <button
                type="button"
                onClick={loadSignedUrl}
                className="button-primary mt-4 text-xs h-9 px-4"
              >
                Retry authorization
              </button>
            </div>
          )}

          {signedUrl && !isLoadingUrl && !error && (
            <>
              {isPdf ? (
                <div className="flex flex-col w-full h-[65vh]">
                  <iframe
                    src={signedUrl}
                    title={asset.original_filename}
                    className="h-full w-full rounded-xl border border-neutral-300 bg-white"
                  />
                  <div className="mt-2 text-center text-[11px] text-neutral-500">
                    If the embedded preview does not render in your browser, use the &ldquo;Open PDF&rdquo; button above.
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={signedUrl}
                    alt={asset.original_filename}
                    className="max-h-[68vh] w-auto max-w-full rounded-lg object-contain shadow-sm border border-neutral-200 bg-white"
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer info */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 bg-neutral-50 px-5 py-3 text-xs text-neutral-500">
          <div>
            <span>Uploaded: {formatAssetDate(asset.created_at)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <span>Authorized 15-minute secure session</span>
          </div>
        </div>
      </div>
    </div>
  );
}


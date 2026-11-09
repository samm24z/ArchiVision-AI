"use client";

import React from "react";
import { Asset } from "@/lib/api";
import { formatBytes, formatAssetDate, getCategoryBadge } from "./asset-formatters";
import { CategoryIcon, EyeIcon, TrashIcon } from "./asset-icons";

interface AssetCardProps {
  asset: Asset;
  isArchived: boolean;
  onPreview: (asset: Asset) => void;
  onDelete: (asset: Asset) => void;
}

export function AssetCard({
  asset,
  isArchived,
  onPreview,
  onDelete,
}: AssetCardProps) {
  const badge = getCategoryBadge(asset.category);
  const isImage = asset.mime_type.startsWith("image/");
  const isPdf = asset.mime_type === "application/pdf";

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs transition hover:border-neutral-300 hover:shadow-sm">
      <div>
        {/* Top bar: Category badge & format tag */}
        <div className="flex items-center justify-between gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${badge.badgeClass}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${badge.dotClass}`} />
            {badge.label}
          </span>
          <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
            {isPdf
              ? "PDF"
              : asset.original_filename.split(".").pop() || "FILE"}
          </span>
        </div>

        {/* Center: Icon and filename */}
        <div className="mt-4 flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700 transition group-hover:bg-neutral-900 group-hover:text-white">
            <CategoryIcon category={asset.category} className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3
              className="text-sm font-semibold tracking-tight text-neutral-900 line-clamp-2 break-all group-hover:text-brand-900"
              title={asset.original_filename}
            >
              {asset.original_filename}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-neutral-500">
              <span>{formatBytes(asset.file_size_bytes)}</span>
              {isImage && asset.width && asset.height && (
                <>
                  <span>•</span>
                  <span>
                    {asset.width} × {asset.height}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer: Date & Actions */}
      <div className="mt-5 flex items-center justify-between border-t border-neutral-100 pt-3.5 text-xs">
        <span className="text-[11px] text-neutral-400">
          {formatAssetDate(asset.created_at)}
        </span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPreview(asset)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-950 focus:outline-none focus:ring-2 focus:ring-brand-500"
            title="Preview asset"
          >
            <EyeIcon className="h-3.5 w-3.5" />
            <span>Preview</span>
          </button>

          {!isArchived && (
            <button
              type="button"
              onClick={() => onDelete(asset)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-neutral-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              title="Delete asset"
              aria-label={`Delete ${asset.original_filename}`}
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


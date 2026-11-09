"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Asset,
  AssetCategory,
  CATEGORY_ALLOWED_FORMATS,
  fetchProjectAssets,
  deleteAsset,
  ApiRequestError,
} from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";
import { AssetCard } from "./asset-card";
import { AssetUploadZone } from "./asset-upload-zone";
import { AssetPreviewModal } from "./asset-preview-modal";
import { AssetDeleteDialog } from "./asset-delete-dialog";
import { UploadCloudIcon } from "./asset-icons";

interface AssetWorkspaceProps {
  projectId: string;
  isArchived: boolean;
}

export function AssetWorkspace({ projectId, isArchived }: AssetWorkspaceProps) {
  const router = useRouter();
  const { getToken, signOut } = useAuth();

  const [assets, setAssets] = useState<Asset[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [error, setError] = useState<string | null>(null);

  const [selectedFilter, setSelectedFilter] = useState<"all" | AssetCategory>(
    "all"
  );
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // Modals state
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [deleteTargetAsset, setDeleteTargetAsset] = useState<Asset | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleSignOutAndRedirect = useCallback(async () => {
    await signOut();
    router.replace(`/login?next=/dashboard/projects/${projectId}`);
  }, [signOut, router, projectId]);

  const loadAssets = useCallback(async () => {
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        await handleSignOutAndRedirect();
        return;
      }
      const data = await fetchProjectAssets(token, projectId);
      setAssets(data);
      setLoadState("ready");
    } catch (err: unknown) {
      if (err instanceof ApiRequestError && err.status === 401) {
        await handleSignOutAndRedirect();
        return;
      }
      const message =
        err instanceof ApiRequestError && err.status === 404
          ? "This project is unavailable or its assets could not be found."
          : err instanceof Error
            ? err.message
            : "Unable to load project assets.";
      setError(message);
      setLoadState("error");
    }
  }, [getToken, projectId, handleSignOutAndRedirect]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  // Handle successful upload
  const handleUploadSuccess = (newAsset: Asset) => {
    setAssets((prev) => [newAsset, ...prev]);
    setIsUploadOpen(false);
  };

  // Handle upload cancellation/abortion — best effort refresh
  const handleUploadAborted = () => {
    void loadAssets();
  };

  // Handle asset deletion
  const handleConfirmDelete = async () => {
    if (!deleteTargetAsset || isArchived) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const token = await getToken();
      if (!token) {
        await handleSignOutAndRedirect();
        return;
      }

      await deleteAsset(token, deleteTargetAsset.id);
      // Remove from state immediately and refresh
      setAssets((prev) =>
        prev.filter((item) => item.id !== deleteTargetAsset.id)
      );
      setDeleteTargetAsset(null);
    } catch (err: unknown) {
      if (err instanceof ApiRequestError && err.status === 401) {
        await handleSignOutAndRedirect();
        return;
      }
      const message =
        err instanceof Error ? err.message : "Failed to delete project asset.";
      setDeleteError(message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered assets
  const filteredAssets = useMemo(() => {
    if (selectedFilter === "all") return assets;
    return assets.filter((asset) => asset.category === selectedFilter);
  }, [assets, selectedFilter]);

  // Counts per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: assets.length,
      sketch: 0,
      floor_plan: 0,
      reference_image: 0,
      document: 0,
    };
    assets.forEach((asset) => {
      if (counts[asset.category] !== undefined) {
        counts[asset.category]++;
      }
    });
    return counts;
  }, [assets]);

  return (
    <section
      className="mt-10 rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8 shadow-xs"
      aria-label="Project Asset Workspace"
    >
      {/* Workspace Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-neutral-200 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">
              Workspace Assets
            </span>
            <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-neutral-700">
              {assets.length} {assets.length === 1 ? "file" : "files"}
            </span>
          </div>
          <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-neutral-950">
            Project Drawings &amp; Context
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-neutral-500 max-w-2xl">
            Sketches, CAD/PDF floor plans, reference imagery, and design
            specifications belonging to this project.
          </p>
        </div>

        {!isArchived && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsUploadOpen((prev) => !prev)}
              className="button-primary text-xs sm:text-sm gap-2"
            >
              <UploadCloudIcon className="h-4 w-4" />
              <span>{isUploadOpen ? "Close uploader" : "Upload asset"}</span>
            </button>
          </div>
        )}
      </div>

      {/* Archived Project Banner */}
      {isArchived && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs sm:text-sm text-amber-900">
          <span className="font-semibold">Project is archived.</span> Asset
          uploads and deletions are disabled for archived projects.
        </div>
      )}

      {/* Upload Zone (Collapsible or visible when requested) */}
      {isUploadOpen && !isArchived && (
        <div className="mt-6">
          <AssetUploadZone
            projectId={projectId}
            isArchived={isArchived}
            getToken={getToken}
            onSignOut={signOut}
            onUploadSuccess={handleUploadSuccess}
            onUploadAborted={handleUploadAborted}
            onCancelZone={() => setIsUploadOpen(false)}
          />
        </div>
      )}

      {/* Workspace Loading State */}
      {loadState === "loading" && (
        <div className="mt-8 space-y-4" aria-busy="true">
          <div className="h-10 w-full animate-pulse rounded-xl bg-neutral-100" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-44 animate-pulse rounded-2xl bg-neutral-100 border border-neutral-200"
              />
            ))}
          </div>
        </div>
      )}

      {/* Workspace Error State */}
      {loadState === "error" && (
        <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm font-semibold text-red-900">
            Failed to load project assets
          </p>
          <p className="mt-1 text-xs text-red-700">{error}</p>
          <button
            type="button"
            onClick={loadAssets}
            className="button-secondary mt-4 text-xs h-9 px-4"
          >
            Retry loading
          </button>
        </div>
      )}

      {/* Ready State */}
      {loadState === "ready" && (
        <div className="mt-6">
          {/* Category Filter Tabs */}
          {assets.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 pb-4">
              <button
                type="button"
                onClick={() => setSelectedFilter("all")}
                className={`rounded-xl px-3 py-1.5 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                  selectedFilter === "all"
                    ? "bg-neutral-900 text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900"
                }`}
              >
                All ({categoryCounts.all})
              </button>
              {(
                [
                  "sketch",
                  "floor_plan",
                  "reference_image",
                  "document",
                ] as AssetCategory[]
              ).map((cat) => {
                const count = categoryCounts[cat] || 0;
                const isSelected = selectedFilter === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedFilter(cat)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                      isSelected
                        ? "bg-brand-600 text-white"
                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900"
                    }`}
                  >
                    {CATEGORY_ALLOWED_FORMATS[cat].label} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {/* Asset Grid or Empty States */}
          {assets.length === 0 ? (
            /* Total Empty State */
            <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-200 bg-neutral-50/50 py-12 px-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-xs border border-neutral-200 text-neutral-500">
                <UploadCloudIcon className="h-6 w-6 text-brand-600" />
              </div>
              <h3 className="mt-4 text-base font-semibold tracking-tight text-neutral-900">
                No project assets yet
              </h3>
              <p className="mt-1 max-w-sm text-xs sm:text-sm text-neutral-500">
                Upload sketches, floor plans, reference imagery, or PDF
                specifications to establish your design context.
              </p>
              {!isArchived && !isUploadOpen && (
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(true)}
                  className="button-primary mt-6 text-xs sm:text-sm"
                >
                  Upload your first asset
                </button>
              )}
            </div>
          ) : filteredAssets.length === 0 ? (
            /* Filter Category Empty State */
            <div className="mt-8 rounded-2xl border border-neutral-200 bg-neutral-50/50 py-10 px-4 text-center">
              <p className="text-sm font-medium text-neutral-800">
                No{" "}
                {selectedFilter !== "all"
                  ? CATEGORY_ALLOWED_FORMATS[selectedFilter].label.toLowerCase()
                  : ""}{" "}
                assets found
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Switch filters or upload a new file to this category.
              </p>
              {!isArchived && !isUploadOpen && (
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(true)}
                  className="button-secondary mt-4 text-xs h-9 px-3"
                >
                  Upload to this project
                </button>
              )}
            </div>
          ) : (
            /* Asset Grid */
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredAssets.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  isArchived={isArchived}
                  onPreview={(target) => setPreviewAsset(target)}
                  onDelete={(target) => {
                    setDeleteError(null);
                    setDeleteTargetAsset(target);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Authorized Preview Lightbox Modal */}
      <AssetPreviewModal
        asset={previewAsset}
        isOpen={Boolean(previewAsset)}
        onClose={() => setPreviewAsset(null)}
        getToken={getToken}
      />

      {/* Asset Deletion Confirmation Alert Dialog */}
      <AssetDeleteDialog
        asset={deleteTargetAsset}
        isOpen={Boolean(deleteTargetAsset)}
        isDeleting={isDeleting}
        error={deleteError}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          if (!isDeleting) {
            setDeleteTargetAsset(null);
            setDeleteError(null);
          }
        }}
      />
    </section>
  );
}


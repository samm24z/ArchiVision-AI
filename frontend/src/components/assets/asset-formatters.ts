import { AssetCategory, CATEGORY_ALLOWED_FORMATS } from "@/lib/api";

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes <= 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatAssetDate(dateString: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(dateString));
  } catch {
    return dateString;
  }
}

export function getCategoryBadge(category: AssetCategory): {
  label: string;
  badgeClass: string;
  dotClass: string;
} {
  switch (category) {
    case "sketch":
      return {
        label: CATEGORY_ALLOWED_FORMATS.sketch.label,
        badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
        dotClass: "bg-amber-500",
      };
    case "floor_plan":
      return {
        label: CATEGORY_ALLOWED_FORMATS.floor_plan.label,
        badgeClass: "bg-sky-50 text-sky-800 border-sky-200",
        dotClass: "bg-sky-500",
      };
    case "reference_image":
      return {
        label: CATEGORY_ALLOWED_FORMATS.reference_image.label,
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
        dotClass: "bg-emerald-500",
      };
    case "document":
      return {
        label: CATEGORY_ALLOWED_FORMATS.document.label,
        badgeClass: "bg-neutral-100 text-neutral-800 border-neutral-300",
        dotClass: "bg-neutral-500",
      };
  }
}


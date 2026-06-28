export type SiteMediaKind = "image" | "video";

export const SITE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const SITE_VIDEO_MAX_BYTES = 25 * 1024 * 1024;

export const SITE_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const SITE_VIDEO_MIME_TYPES = new Set(["video/mp4", "video/webm"]);

export const SITE_MEDIA_BUCKET = "site-images";

export function siteMediaKindFromMime(mime: string): SiteMediaKind | null {
  if (SITE_IMAGE_MIME_TYPES.has(mime)) return "image";
  if (SITE_VIDEO_MIME_TYPES.has(mime)) return "video";
  return null;
}

export function extForSiteMedia(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "video/mp4":
      return "mp4";
    case "video/webm":
      return "webm";
    default:
      return "bin";
  }
}

export function validateSiteMediaFile(file: File): { error?: string; kind?: SiteMediaKind } {
  const kind = siteMediaKindFromMime(file.type);
  if (!kind) {
    return { error: "Format non supporté (JPEG, PNG, WebP, GIF, MP4, WebM)." };
  }
  const max = kind === "video" ? SITE_VIDEO_MAX_BYTES : SITE_IMAGE_MAX_BYTES;
  if (file.size > max) {
    return {
      error:
        kind === "video"
          ? "Vidéo trop volumineuse (max 25 Mo)."
          : "Image trop volumineuse (max 5 Mo).",
    };
  }
  return { kind };
}

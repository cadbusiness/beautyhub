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

export type SiteMediaErrorKey = "unsupportedFormat" | "videoTooLarge" | "imageTooLarge";

export function validateSiteMediaFile(file: File): { errorKey?: SiteMediaErrorKey; kind?: SiteMediaKind } {
  const kind = siteMediaKindFromMime(file.type);
  if (!kind) {
    return { errorKey: "unsupportedFormat" };
  }
  const max = kind === "video" ? SITE_VIDEO_MAX_BYTES : SITE_IMAGE_MAX_BYTES;
  if (file.size > max) {
    return {
      errorKey: kind === "video" ? "videoTooLarge" : "imageTooLarge",
    };
  }
  return { kind };
}

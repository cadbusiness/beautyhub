import {
  normalizeSitePageStyle,
  SITE_PAGE_MAX_WIDTH_CLASS,
  sitePageContentStyle,
  type SitePageStyle,
} from "@/lib/institut/site-page-style";
import { cn } from "@/lib/utils";

export function SitePageStyleWrapper({
  style,
  className,
  children,
}: {
  style: SitePageStyle | unknown;
  className?: string;
  children: React.ReactNode;
}) {
  const normalized = normalizeSitePageStyle(style);

  return (
    <div
      className={cn("mx-auto w-full", SITE_PAGE_MAX_WIDTH_CLASS[normalized.maxWidth], className)}
      style={sitePageContentStyle(normalized)}
    >
      {children}
    </div>
  );
}

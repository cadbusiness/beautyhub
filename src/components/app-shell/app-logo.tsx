import Image from "next/image";
import Link from "next/link";

export function AppLogo({ href = "/dashboard" }: { href?: string }) {
  return (
    <Link href={href} className="flex shrink-0 items-center">
      <Image
        src="/brand/logo-header.png"
        alt="Beauty Hub"
        width={148}
        height={34}
        className="h-8 w-auto"
        priority
      />
    </Link>
  );
}

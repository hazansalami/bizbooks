import Link from "next/link";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** The BizBooks "B" mark on its own. Artwork in /public/brand, made from the brand master files. */
export function Mark({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/mark.png" alt="" aria-hidden width={32} height={32} className={cn("size-8 shrink-0 object-contain", className)} />;
}

/** Full logo: mark and wordmark. `light` swaps to white "Biz" for dark backgrounds. */
export function Logo({ href = "/", className, light }: { href?: string; className?: string; light?: boolean }) {
  return (
    <Link href={href} className={cn("inline-flex min-h-11 shrink-0 items-center", className)} aria-label={`${APP_NAME} home`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={light ? "/brand/logo-light.png" : "/brand/logo.png"} alt={APP_NAME} width={167} height={32} className="h-7 w-auto max-w-none shrink-0 object-contain sm:h-8" />
    </Link>
  );
}

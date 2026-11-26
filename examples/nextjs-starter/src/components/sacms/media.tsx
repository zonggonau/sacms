import { cn } from "@/lib/utils"

// Plain <img> on purpose: SaCMS media can come from any storage host, and
// next/image would need a remotePatterns entry for each one.
export function MediaImage({ url, alt, className }: { url: string; alt: string; className?: string }) {
  return <img src={url} alt={alt} loading="lazy" className={cn("h-auto w-full rounded-xl object-cover", className)} />
}

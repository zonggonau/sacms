"use client"

import { usePathname } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"

/**
 * Home/Fitur/Harga/Tentang keep their own URLs (bookmarkable, shareable,
 * individually indexable — unlike merging them into one literal page) but
 * transition between each other like a single-page app: no full reload,
 * header/footer never remount, just a quick crossfade of the page content.
 * Blog (and its own post pages) is deliberately excluded — it renders
 * through untouched, same as a normal Next.js page navigation, since it
 * doesn't need (or want) to feel glued to the other four.
 */
const SPA_PAGES = new Set(["/", "/fitur", "/harga", "/tentang"])

export function MarketingPageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (!SPA_PAGES.has(pathname)) {
    return <>{children}</>
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.18, ease: "easeInOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

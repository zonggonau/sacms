"use client"

import { SandpackProvider, SandpackPreview as SandpackPreviewPane, SandpackLayout } from "@codesandbox/sandpack-react"
import { useTheme } from "next-themes"
import { useMemo } from "react"

interface GeneratedFile {
  name: string
  content: string
}

interface SandpackPreviewProps {
  files: GeneratedFile[]
}

// Sandpack's "react-ts" template has no `next` package, so any generated
// file importing from "next/*" fails with "Could not find dependency: 'next'".
// A /node_modules/next/... file shim was tried first, but Sandpack's
// dependency installer treats any package.json under /node_modules as a
// real package to resolve/fetch, which hung on a nonexistent "next" version
// (blank preview, no error). Rewriting the import specifiers to plain
// relative paths (below) avoids that dependency-resolution step entirely —
// only the in-memory preview copy is rewritten, never the stored/deployed
// source.
const NEXT_SHIM_SOURCE_FILES: Record<string, string> = {
  "/_shims/link.tsx": `import React from "react";
export default function Link({ href, children, ...props }: any) {
  return <a href={typeof href === "string" ? href : href?.pathname || "#"} {...props}>{children}</a>;
}
`,
  "/_shims/image.tsx": `import React from "react";
export default function Image({ src, alt, fill, priority, sizes, quality, placeholder, blurDataURL, loader, ...props }: any) {
  return <img src={src} alt={alt || ""} {...props} />;
}
`,
  "/_shims/navigation.tsx": `export function useRouter() {
  return { push: () => {}, replace: () => {}, back: () => {}, prefetch: () => {}, refresh: () => {} };
}
export function usePathname() { return "/"; }
export function useSearchParams() { return new URLSearchParams(); }
export function useParams() { return {}; }
export function redirect() {}
`,
}

function rewriteNextImports(content: string): string {
  return content
    .replace(/(["'])next\/link\1/g, '$1/_shims/link$1')
    .replace(/(["'])next\/image\1/g, '$1/_shims/image$1')
    .replace(/(["'])next\/navigation\1/g, '$1/_shims/navigation$1')
}

/**
 * Renders an AI-generated Next.js file set in an in-browser Sandpack
 * sandbox. This is a MOCK preview, not a real Next.js server: it renders
 * the App Router's page/layout tree as plain React components via
 * Sandpack's "react-ts" template, with next/link, next/image, and
 * next/navigation import specifiers rewritten to local shims (see
 * NEXT_SHIM_SOURCE_FILES / rewriteNextImports) since no real `next` package
 * is available in-sandbox. `fetch()` calls to the real SaCMS Content API
 * will fail inside the sandbox's isolated iframe (no network access to
 * localhost) — this is a known, accepted limitation of the mock-preview
 * approach; components should already fall back to their Unsplash sample
 * data when a fetch fails, same as they're instructed to in the generation
 * prompt.
 */
export function SandpackPreview({ files }: SandpackPreviewProps) {
  const { theme } = useTheme()

  const sandpackFiles = useMemo(() => {
    const out: Record<string, string> = {}

    // Map every generated file into Sandpack paths, supporting both /src, root, and relative aliases
    for (const file of files) {
      const clean = file.name.replace(/^\//, "")
      const content = rewriteNextImports(file.content)
      out[`/${clean}`] = content
      // Also map @/ aliases (e.g. src/components -> components) for clean module resolution
      if (clean.startsWith("src/")) {
        out[`/${clean.replace(/^src\//, "")}`] = content
      }
      if (clean.startsWith("components/")) {
        out[`/src/${clean}`] = content
        // Also support ./Navbar from root
        out[`/${clean.replace(/^components\//, "")}`] = content
      }
      if (clean.startsWith("app/")) {
        out[`/src/${clean}`] = content
      }
    }

    // Universal Entry Point Resolution across all supported frameworks:
    // 1. Next.js App Router: app/page.tsx or pages/index.tsx
    // 2. Vite React SPA: src/App.tsx or App.tsx
    // 3. Remix: app/routes/_index.tsx or app/root.tsx
    // 4. Astro / Vue fallback: any primary page component
    const entryFile =
      files.find((f) => f.name === "app/page.tsx" || f.name.endsWith("/page.tsx")) ||
      files.find((f) => f.name === "src/App.tsx" || f.name === "App.tsx" || f.name.endsWith("/App.tsx")) ||
      files.find((f) => f.name === "app/routes/_index.tsx" || f.name.endsWith("/_index.tsx")) ||
      files.find((f) => f.name.endsWith(".tsx") && !f.name.includes("layout") && !f.name.includes("sacms")) ||
      files[0]

    if (entryFile) {
      const cleanPath = entryFile.name.replace(/^\//, "")
      if (cleanPath === "App.tsx" || cleanPath === "src/App.tsx") {
        out["/App.tsx"] = rewriteNextImports(entryFile.content)
      } else {
        const importPath = cleanPath.replace(/\.(tsx|jsx|js|ts)$/, "")
        out["/App.tsx"] = `import React from "react";
import EntryPage from "./${importPath}";

export default function App() {
  const Component = (EntryPage as any)?.default || EntryPage;
  return typeof Component === "function" ? <Component /> : (
    <div className="p-8 text-center text-slate-400">
      <p>Komponen halaman siap dimuat.</p>
    </div>
  );
}
`
      }
    }

    out["/index.tsx"] = `import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import App from "./App";

const root = createRoot(document.getElementById("root")!);
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
`

    out["/styles.css"] = `@tailwind base;
@tailwind components;
@tailwind utilities;

body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
`

    out["/tailwind.config.js"] = `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
}
`

    Object.assign(out, NEXT_SHIM_SOURCE_FILES)

    return out
  }, [files])

  return (
    <div className="h-full w-full overflow-hidden flex flex-col sp-custom-full-height">
      <style>{`
        .sp-custom-full-height,
        .sp-custom-full-height .sp-wrapper,
        .sp-custom-full-height .sp-layout,
        .sp-custom-full-height .sp-stack,
        .sp-custom-full-height .sp-preview,
        .sp-custom-full-height .sp-preview-container,
        .sp-custom-full-height .sp-preview-iframe {
          height: 100% !important;
          max-height: 100% !important;
          min-height: 100% !important;
          width: 100% !important;
          display: flex !important;
          flex-direction: column !important;
          flex: 1 1 0% !important;
        }
        .sp-custom-full-height .sp-layout {
          border: none !important;
          border-radius: 0 !important;
          background: transparent !important;
        }
        .sp-custom-full-height .sp-preview {
          background: transparent !important;
        }
        .sp-custom-full-height .sp-preview-iframe {
          border: none !important;
        }
      `}</style>
      <SandpackProvider
        template="react-ts"
        theme={theme === "dark" ? "dark" : "light"}
        files={sandpackFiles}
        className="h-full w-full flex flex-col flex-1"
        customSetup={{
          dependencies: {
            "lucide-react": "latest",
          },
        }}
        options={{
          externalResources: ["https://cdn.tailwindcss.com"],
        }}
      >
        <SandpackLayout style={{ height: "100%", width: "100%", border: "none" }}>
          <SandpackPreviewPane
            showNavigator={false}
            showOpenInCodeSandbox={false}
            showRefreshButton
            style={{ height: "100%", width: "100%" }}
          />
        </SandpackLayout>
      </SandpackProvider>
    </div>
  )
}

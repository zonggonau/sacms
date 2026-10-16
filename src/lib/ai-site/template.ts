/**
 * The Next.js app every AI Site project starts from. The agent edits these
 * files; the sandbox installs and runs them. Keep dependencies minimal so
 * `npm install` stays fast.
 */
export const STARTER_FILES: Record<string, string> = {
  "package.json": `${JSON.stringify(
    {
      name: "sacms-site",
      private: true,
      scripts: {
        dev: "next dev --hostname 0.0.0.0 --port 3000",
        build: "next build",
        start: "next start --hostname 0.0.0.0 --port 3000",
      },
      dependencies: {
        next: "16.2.4",
        react: "19.2.5",
        "react-dom": "19.2.5",
      },
      devDependencies: {
        "@tailwindcss/postcss": "^4",
        "@types/node": "^22",
        "@types/react": "^19",
        "@types/react-dom": "^19",
        tailwindcss: "^4",
        typescript: "^5",
      },
    },
    null,
    2,
  )}\n`,
  "next.config.ts": `import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // The preview is served from the sandbox's *.vercel.run domain.
  allowedDevOrigins: ['*.vercel.run'],
}

export default nextConfig
`,
  "tsconfig.json": `${JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        lib: ["dom", "dom.iterable", "esnext"],
        allowJs: false,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: "esnext",
        moduleResolution: "bundler",
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: "react-jsx",
        incremental: true,
        plugins: [{ name: "next" }],
        paths: { "@/*": ["./*"] },
      },
      include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
      exclude: ["node_modules"],
    },
    null,
    2,
  )}\n`,
  "postcss.config.mjs": `export default {
  plugins: { '@tailwindcss/postcss': {} },
}
`,
  "app/globals.css": `@import 'tailwindcss';
`,
  "app/layout.tsx": `import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Website',
  description: 'Built with SaCMS',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-dvh bg-white text-neutral-900 antialiased">{children}</body>
    </html>
  )
}
`,
  "app/page.tsx": `export default function Home() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-8">
      <p className="text-neutral-500">Describe your website in the chat to start building.</p>
    </main>
  )
}
`,
  ".gitignore": `node_modules
.next
next-env.d.ts
`,
}

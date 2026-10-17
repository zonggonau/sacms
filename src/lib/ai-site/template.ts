/**
 * The Next.js app every AI Site project starts from. The agent edits these
 * files; the sandbox installs and runs them. Ships with a shadcn/ui
 * foundation (components.json, cn() helper, CSS variable theme, Button)
 * already wired up so the agent builds real shadcn-style UI from the first
 * turn — add more primitives with `npx shadcn@latest add <name>`, or
 * hand-write new components following Button's cva pattern.
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
        "class-variance-authority": "^0.7.1",
        clsx: "^2.1.1",
        "tailwind-merge": "^3.0.2",
        "lucide-react": "^0.475.0",
        "@radix-ui/react-slot": "^1.1.2",
        "@sacms/sdk": "^1.0.0",
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
  "components.json": `${JSON.stringify(
    {
      $schema: "https://ui.shadcn.com/schema.json",
      style: "new-york",
      rsc: true,
      tsx: true,
      tailwind: { config: "", css: "app/globals.css", baseColor: "neutral", cssVariables: true, prefix: "" },
      aliases: { components: "@/components", utils: "@/lib/utils", ui: "@/components/ui", lib: "@/lib", hooks: "@/hooks" },
      iconLibrary: "lucide",
    },
    null,
    2,
  )}\n`,
  "lib/utils.ts": `import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
`,
  "components/ui/button.tsx": `import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
        destructive: 'bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20',
        outline: 'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button'
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

export { Button, buttonVariants }
`,
  "app/globals.css": `@import 'tailwindcss';

@custom-variant dark (&:is(.dark *));

:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}
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
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  )
}
`,
  "app/page.tsx": `export default function Home() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-8">
      <p className="text-muted-foreground">Describe your website in the chat to start building.</p>
    </main>
  )
}
`,
  "lib/sacms.ts": `import { SaCMS } from '@sacms/sdk'

/**
 * This workspace's own SaCMS instance, already configured — the connection
 * (API URL, tenant, key) is injected automatically into every preview and
 * every real deploy, the same way for both. Use this for any Content Type,
 * Single Type, or Component data the site needs; never call the SaCMS API
 * with a hand-rolled fetch.
 *
 *   const { data: posts } = await sacms.collection('articles').findMany({ sort: 'createdAt:desc' })
 *   const { data: home } = await sacms.single('homepage').find()
 */
export const sacms = new SaCMS({
  baseUrl: process.env.NEXT_PUBLIC_SACMS_API_URL!,
  tenant: process.env.NEXT_PUBLIC_SACMS_TENANT!,
  token: process.env.SACMS_API_KEY!,
})
`,
  ".gitignore": `node_modules
.next
next-env.d.ts
.env*.local
`,
}

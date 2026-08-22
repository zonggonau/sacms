import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db, getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import JSZip from "jszip"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant: tenantSlug } = await params
    const access = await getTenantAccess(session, tenantSlug)
    if (!access) {
      return NextResponse.json({ error: "Tenant not found or unauthorized" }, { status: 404 })
    }

    const tenant = access.tenant
    const tenantDb = await getTenantDb(tenant.id)

    // 1. Fetch available API key or token for tenant
    let apiKey = await db.apiKey.findFirst({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" }
    })

    const tokenValue = apiKey?.key || "sacms_demo_read_only_token"
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"

    // 2. Fetch schema collections
    const contentTypes = await tenantDb.contentType.findMany({
      where: { tenantId: tenant.id },
      include: { schemaFields: true }
    })

    const primaryCollection = contentTypes[0]?.slug || "articles"

    // 3. Create ZIP archive
    const zip = new JSZip()

    // 3.1 package.json
    zip.file(
      "package.json",
      JSON.stringify(
        {
          name: `sacms-${tenant.slug}-starter`,
          version: "1.0.0",
          private: true,
          scripts: {
            dev: "next dev",
            build: "next build",
            start: "next start",
            lint: "next lint"
          },
          dependencies: {
            next: "^16.0.0",
            react: "^19.0.0",
            "react-dom": "^19.0.0",
            "lucide-react": "^0.474.0",
            clsx: "^2.1.1",
            "tailwind-merge": "^2.6.0"
          },
          devDependencies: {
            typescript: "^5.7.3",
            "@types/node": "^22.10.7",
            "@types/react": "^19.0.7",
            "@types/react-dom": "^19.0.3",
            tailwindcss: "^4.0.0",
            postcss: "^8.5.1"
          }
        },
        null,
        2
      )
    )

    // tsconfig.json
    zip.file(
      "tsconfig.json",
      JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            lib: ["dom", "dom.iterable", "esnext"],
            allowJs: true,
            skipLibCheck: true,
            strict: true,
            noEmit: true,
            esModuleInterop: true,
            module: "esnext",
            moduleResolution: "bundler",
            resolveJsonModule: true,
            isolatedModules: true,
            jsx: "preserve",
            incremental: true,
            plugins: [{ name: "next" }],
            paths: {
              "@/*": ["./*"]
            }
          },
          include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
          exclude: ["node_modules"]
        },
        null,
        2
      )
    )

    // postcss.config.mjs
    zip.file(
      "postcss.config.mjs",
      `export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
`
    )

    // .env.local
    zip.file(
      ".env.local",
      `# SaCMS API Configuration
NEXT_PUBLIC_SACMS_URL=${baseUrl}
NEXT_PUBLIC_TENANT_SLUG=${tenant.slug}
SACMS_API_TOKEN=${tokenValue}
`
    )

    // .env.example
    zip.file(
      ".env.example",
      `# SaCMS API Configuration
NEXT_PUBLIC_SACMS_URL=http://localhost:3000
NEXT_PUBLIC_TENANT_SLUG=your-tenant-slug
SACMS_API_TOKEN=your-api-token
`
    )

    // lib/sacms.ts
    zip.file(
      "lib/sacms.ts",
      `import { SaCMS } from "@sacms/sdk";

export const sacms = new SaCMS({
  baseUrl: process.env.NEXT_PUBLIC_SACMS_URL || "${baseUrl}",
  tenant: process.env.NEXT_PUBLIC_TENANT_SLUG || "${tenant.slug}",
  token: process.env.SACMS_API_TOKEN || "${tokenValue}",
});
`
    )

    // app/globals.css
    zip.file(
      "app/globals.css",
      `@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #09090b;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #09090b;
    --foreground: #fafafa;
  }
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
}
`
    )

    // app/layout.tsx
    zip.file(
      "app/layout.tsx",
      `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "${tenant.name} — Powered by SaCMS",
  description: "Live web application built with SaCMS Headless CMS and Next.js 16.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="antialiased min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
`
    )

    // app/page.tsx
    zip.file(
      "app/page.tsx",
      `import { sacms } from "@/lib/sacms";
import { Sparkles, Layers, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Fetch collection entries from SaCMS
  let entries: any[] = [];
  try {
    const res = await sacms.collection("${primaryCollection}").query().limit(6).fetch();
    entries = res.data || [];
  } catch (err) {
    console.error("Failed to fetch entries:", err);
  }

  return (
    <div className="flex-1 max-w-6xl w-full mx-auto px-6 py-16 space-y-12">
      {/* Hero Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 border border-orange-500/20 text-xs font-bold">
          <Sparkles className="w-3.5 h-3.5" />
          Terhubung ke SaCMS (${tenant.slug})
        </div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight">
          ${tenant.name}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-base md:text-lg">
          Aplikasi Next.js 16 siap produksi terintegrasi penuh dengan API Headless SaCMS.
        </p>
      </div>

      {/* Content Collection Showcase */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-orange-500" />
            <h2 className="text-xl font-bold">Koleksi: ${primaryCollection}</h2>
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800">
            {entries.length} Entri Ditemukan
          </span>
        </div>

        {entries.length === 0 ? (
          <div className="p-12 text-center border border-dashed rounded-2xl text-gray-500 space-y-2">
            <p className="font-bold">Belum ada data entri di koleksi "${primaryCollection}"</p>
            <p className="text-xs">Buka Dashboard SaCMS untuk menambahkan konten baru.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {entries.map((item: any, idx: number) => {
              const data = item.data || item;
              const title = data.title || data.name || data.judul || \`Item #\${idx + 1}\`;
              const description = data.description || data.excerpt || data.deskripsi || "";
              const image = data.coverImage || data.image || data.photo || null;

              return (
                <div 
                  key={item.id || idx}
                  className="rounded-2xl border bg-white dark:bg-zinc-900 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col"
                >
                  {image && (
                    <div className="h-44 w-full bg-gray-100 overflow-hidden">
                      <img src={image} alt={title} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100 line-clamp-1">{title}</h3>
                      {description && (
                        <p className="text-xs text-gray-500 line-clamp-2 mt-1">{description}</p>
                      )}
                    </div>
                    <div className="pt-2 text-xs font-bold text-orange-600 flex items-center gap-1">
                      Lihat Detail <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
`
    )

    // README.md
    zip.file(
      "README.md",
      `# ${tenant.name} — Next.js 16 Starter App

Aplikasi web modern berbasis **Next.js 16 (App Router)** dan **Tailwind CSS v4** yang sudah terkonfigurasi dengan **SaCMS Headless API**.

## 🚀 Cara Menjalankan Proyek

1. **Instal dependensi:**
   \`\`\`bash
   npm install
   # atau
   bun install
   \`\`\`

2. **Jalankan server pengembangan:**
   \`\`\`bash
   npm run dev
   # atau
   bun dev
   \`\`\`

3. **Buka di browser:**
   Kunjungi [http://localhost:3000](http://localhost:3000).

## ⚙️ Konfigurasi Lingkungan

Konfigurasi koneksi ke SaCMS tersimpan di file \`.env.local\`:
- \`NEXT_PUBLIC_SACMS_URL\`: URL instance SaCMS Anda.
- \`NEXT_PUBLIC_TENANT_SLUG\`: Slug workspace tenant (\`${tenant.slug}\`).
- \`SACMS_API_TOKEN\`: API Key untuk autentikasi data publik.

## 📦 Menggunakan SDK SaCMS

\`\`\`ts
import { sacms } from "@/lib/sacms";

// Mengambil data koleksi
const res = await sacms.collection("articles").query().limit(10).fetch();
console.log(res.data);
\`\`\`
`
    )

    // Generate ZIP buffer
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" })

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="sacms-starter-${tenant.slug}.zip"`,
        "Cache-Control": "no-store"
      }
    })
  } catch (error: any) {
    console.error("[EXPORT_STARTER_ERROR]", error)
    return NextResponse.json({ error: "Gagal mengekspor starter project." }, { status: 500 })
  }
}

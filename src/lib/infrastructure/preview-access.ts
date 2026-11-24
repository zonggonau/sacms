import { createHmac, timingSafeEqual } from "node:crypto"

export function previewCredential(id: string, audience: "browser" | "upstream" | "probe" | "proof") {
  const key = process.env.NEXTAUTH_SECRET
  if (!key) throw Error("Preview access signing is not configured")
  return createHmac("sha256", key).update("sacms-preview:" + audience + ":" + id).digest("hex")
}

export function matchesPreviewCredential(value: string | undefined, expected: string) {
  return !!value && /^[0-9a-f]{64}$/.test(value) && timingSafeEqual(Buffer.from(value), Buffer.from(expected))
}

// A successful HEAD must traverse the public TLS endpoint and reach the
// authenticated relay. The probe grants no access to page content.
export const previewProbePath = "/.well-known/sacms-preview-health"
export async function verifyPublicPreview(id: string) {
  const url = `https://${id}.preview.sacms.cloud${previewProbePath}`
  let detail = ""
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        method: "HEAD", redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(8000),
        headers: { "x-sacms-preview-probe": previewCredential(id, "probe") },
      })
      if (response.status === 204 && matchesPreviewCredential(response.headers.get("x-sacms-preview-proof") ?? undefined, previewCredential(id, "proof"))) return
      detail = `HTTP ${response.status}`
    } catch {
      detail = "gagal menyambung melalui DNS/TLS"
    }
    if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 1000))
  }
  throw Error(`Sandbox berjalan, tetapi URL publik ${url} belum dapat diverifikasi (${detail}). Periksa DNS wildcard preview, TLS Caddy, dan koneksi proxy ke Sandbox.`)
}

// Only this authenticated relay is exposed as a Sandbox port. Next's dev
// server listens on loopback. The browser credential never enters the box.
export const previewRelay = `
const http = require("node:http");
http.createServer((req, res) => {
  if (req.headers["x-sacms-preview"] !== process.env.PREVIEW_UPSTREAM_KEY) {
    res.writeHead(403).end();
    return;
  }
  const upstream = http.request({hostname:"127.0.0.1", port:3000, path:req.url, method:req.method, headers:{accept:req.headers.accept || "*/*"}}, response => {
    res.writeHead(response.statusCode, response.headers);
    response.pipe(res);
  });
  upstream.on("error", () => res.writeHead(502).end());
  req.pipe(upstream);
}).listen(3001, "0.0.0.0");
`

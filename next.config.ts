import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import { execSync } from "child_process";

// Config reload trigger

// Dynamically detect any active local Cloudflare Tunnel or local tunneling tools
function getTunnelOrigins(): string[] {
  const origins: string[] = [];
  // Scan common local cloudflared metrics ports (20242, 20241)
  for (const port of [20242, 20241]) {
    try {
      const output = execSync(`curl -s --max-time 1 http://127.0.0.1:${port}/metrics`, {
        stdio: ["ignore", "pipe", "ignore"],
      }).toString();
      const match = output.match(/userHostname="https:\/\/([^"]+)"/);
      if (match && match[1]) {
        origins.push(match[1]);
      }
    } catch {
      // Quietly ignore network or command failures
    }
  }
  return origins;
}

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: {
    "/api/mcp/global-schema/\\[\\[\\.\\.\\.transport\\]\\]": [
      "./src/lib/infrastructure/sacms-global-website-workflow.md",
    ],
  },
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  async rewrites() {
    // OAuth discovery (RFC 9728 / RFC 8414) lives at /.well-known/*, which clients
    // expect at the origin root. The handler sits under /api/oauth/.
    return [{ source: "/.well-known/:path*", destination: "/api/oauth/well-known/:path*" }]
  },
  serverExternalPackages: ["node:inspector"],
  experimental: {
    agentUpgrade: "security",
  },
  allowedDevOrigins: [
    "localhost:3000",
    "localhost:3001",
    "sacms.test",
    "*.sacms.test",
    "sacms.cloud",
    "*.sacms.cloud",
    "developer.sacms.cloud",
    "cms.sacms.cloud",
    "admin.sacms.cloud",
    "api.sacms.cloud",
    "wherever-attendance-mae-scenic.trycloudflare.com",
    "*.trycloudflare.com",
    ...getTunnelOrigins(),
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      }
    ],
  },
};

export default nextConfig;


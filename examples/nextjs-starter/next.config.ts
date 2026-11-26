import path from "node:path";
import type { NextConfig } from "next";

// No image remotePatterns here on purpose: media is rendered with a plain <img>
// so the starter works with any SaCMS storage host without config changes.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep Turbopack inside this folder. When the starter lives inside another
  // project, Next otherwise picks up that project's root and its files.
  turbopack: { root: path.resolve(process.cwd()) },
};

export default nextConfig;

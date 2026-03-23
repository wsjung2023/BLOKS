// Next.js 15 config — transpiles PixiJS ESM, reads env from process.env
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["pixi.js", "@pixi/assets", "@pixi/core"],
  env: {
    NEXT_PUBLIC_API_URL: process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:4000",
    NEXT_PUBLIC_APP_NAME: process.env["NEXT_PUBLIC_APP_NAME"] ?? "BLOKS",
  },
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;

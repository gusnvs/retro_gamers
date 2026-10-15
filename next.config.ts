import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // lets a verification build run without touching a running server's .next
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;

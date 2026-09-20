import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  agentRules: false,
  allowedDevOrigins: ["127.0.0.1"],
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["pdfjs-dist"],
}

export default nextConfig

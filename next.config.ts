import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["xlsx", "xlsx-js-style"],
  allowedDevOrigins: ["192.168.1.50", "192.168.1.30"],
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["xlsx", "xlsx-js-style"],
  allowedDevOrigins: ['192.168.1.50'],
};

export default nextConfig;

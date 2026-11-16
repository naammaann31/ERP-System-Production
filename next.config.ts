
import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Content-Security-Policy",
    value: "default-src 'self' 'unsafe-inline' 'unsafe-eval' https: wss: data: blob:;",
  },
  {
    key: "Access-Control-Allow-Origin",
    value:
      process.env.NODE_ENV === "production"
        ? "https://erp-system-production.vercel.app"
        : "*",
  },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["xlsx", "xlsx-js-style"],

  // Allow local development origins
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "192.168.29.213",
    "192.168.1.22",
    "192.168.1.6",
    "192.168.1.50",
    "192.168.1.30",
    "192.168.1.18",
    "192.168.1.109",
    "192.168.1.108",
    "192.168.1.72",
  ],

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;

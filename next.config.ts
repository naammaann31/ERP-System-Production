import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self' 'unsafe-inline' 'unsafe-eval' https: wss: data: blob:;"
  },
  {
    key: 'Access-Control-Allow-Origin',
    value: process.env.NODE_ENV === 'production' ? 'https://erp-system-production.vercel.app' : '*'
  }
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["xlsx", "xlsx-js-style"],
  allowedDevOrigins: ["192.168.1.50", "192.168.1.30"],
  async headers() {
    return [
      {
        // Apply these headers to all routes in your application.
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
};

export default nextConfig;

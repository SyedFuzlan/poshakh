import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  images: {
    remotePatterns: [
      { protocol: "http",  hostname: "localhost",        port: "9000" },
      { protocol: "http",  hostname: "127.0.0.1",        port: "9000" },
      { protocol: "https", hostname: "madebyzohra.in"                  },
      { protocol: "https", hostname: "www.madebyzohra.in"              },
      { protocol: "https", hostname: "poshakh-production.up.railway.app" },
    ],
    deviceSizes: [640, 750, 1080, 1200, 1920],
    minimumCacheTTL: 86400,
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://cdn.razorpay.com https://us-assets.i.posthog.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "frame-src https://api.razorpay.com https://checkout.razorpay.com",
              "connect-src 'self' https://api.razorpay.com https://checkout.razorpay.com https://cdn.razorpay.com https://lumberjack.razorpay.com https://poshakh-production.up.railway.app https://us-assets.i.posthog.com https://us.i.posthog.com",
              "font-src 'self' data:",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
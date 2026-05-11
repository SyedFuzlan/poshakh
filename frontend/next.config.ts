import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  images: {
    remotePatterns: [
      { protocol: "http",  hostname: "localhost",        port: "9000" },
      { protocol: "http",  hostname: "127.0.0.1",        port: "9000" },
      { protocol: "https", hostname: "madebyzohra.in"                  },
      { protocol: "https", hostname: "www.madebyzohra.in"              },
    ],
    deviceSizes: [640, 750, 1080, 1200, 1920],
    minimumCacheTTL: 86400,
  },
};

export default nextConfig;
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    serverActions: true,
  },
  env: {
    API_URL: process.env.API_URL || "http://localhost:3001",
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${process.env.API_URL || "http://localhost:3001"}/v1/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;

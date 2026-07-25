/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      "/api/cron/daily": ["./fonts/**"],
    },
  },
};

module.exports = nextConfig;

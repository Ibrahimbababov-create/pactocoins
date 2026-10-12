/** @type {import('next').NextConfig} */
const nextConfig = {
  // Линтер гоняем отдельно (npm run lint): его замечания не должны
  // ронять выкладку на Vercel.
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    outputFileTracingIncludes: {
      "/api/cron/daily": ["./fonts/**"],
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.pexels.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "commons.wikimedia.org" },
      { protocol: "https", hostname: "cdn.simpleicons.org" },
      // Хранилище Supabase (Франкфурт). Файлы со старого токийского
      // перенесены 10.10.2026.
      { protocol: "https", hostname: "amehprftteabxwyywryv.supabase.co" },
    ],
  },
};

module.exports = nextConfig;

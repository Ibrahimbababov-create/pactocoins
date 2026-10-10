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
      // Франкфурт — текущее хранилище. Токийский адрес оставлен ради
      // картинок, загруженных до переезда: их ссылки ведут туда.
      { protocol: "https", hostname: "amehprftteabxwyywryv.supabase.co" },
      { protocol: "https", hostname: "grawzgpmohbsvrzyeuou.supabase.co" },
    ],
  },
};

module.exports = nextConfig;

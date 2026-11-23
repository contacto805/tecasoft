/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
  devIndicators: false,
  async headers() {
    return ["/lot/:token", "/trazabilidad/:token", "/portal-productores"].map(source => ({
      source,
      headers: [
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
        { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
      ],
    }));
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '**.githubusercontent.com' },
      { protocol: 'https', hostname: '**.googleusercontent.com' },
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;

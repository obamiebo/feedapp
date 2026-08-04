/** @type {import('next').NextConfig} */
const embedAllowedOrigins = (process.env.EMBED_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  typedRoutes: true,
  async headers() {
    if (embedAllowedOrigins.length === 0) {
      return [];
    }

    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors 'self' ${embedAllowedOrigins.join(" ")}`
          }
        ]
      }
    ];
  }
};

export default nextConfig;

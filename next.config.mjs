/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // Contenido subido por el panel admin/rrhh (video, PDF, slides): nunca
        // debe servirse desde caché de navegador/proxy, ya que el mismo path
        // puede reemplazar su contenido en cualquier momento.
        source: "/presentations/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ]
  },
  images: { unoptimized: true },
}

export default nextConfig

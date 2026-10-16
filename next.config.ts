import type { NextConfig } from "next";

// Cabeceras de seguridad para todas las rutas. ponytail: sin CSP con nonce (Next inyecta scripts en línea);
// añadirla cuando haya una ruta que renderice HTML de usuarios.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// Host de Supabase Storage, para <Image> con las fotos de items.
const supabaseHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : null;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/item-images/**" }]
      : [],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Teselas del mapa: no cambian de nombre, así que el navegador no necesita revalidarlas cada visita.
      // ponytail: si se regeneran las teselas, versionar la ruta (p. ej. /mapa/v2/...).
      { source: "/mapa/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
    ];
  },
  // El navegador reutiliza 30 s las páginas ya vistas (atrás/adelante y clics repetidos al instante).
  // Las acciones con revalidatePath la invalidan.
  experimental: { staleTimes: { dynamic: 30 } },
  // Cache Components desactivado: toda la app es privada y por usuario, no hay HTML estático que prerenderizar.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

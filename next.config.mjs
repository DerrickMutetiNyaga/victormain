/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Google and many clients request /favicon.ico; App Router serves the logo from /icon.png.
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/icon.png" }]
  },
  images: {
    unoptimized: false, // Enable image optimization for better performance
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
    formats: ['image/avif', 'image/webp'], // Use modern image formats
  },
}

export default nextConfig

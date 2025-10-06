const nextConfig = {
  skipTrailingSlashRedirect: true,
  serverExternalPackages: ['@supabase/supabase-js'],
        eslint: {
          // Warning: This allows production builds to successfully complete even if
          // your project has ESLint errors.
          ignoreDuringBuilds: true,
        },
  typescript: {
    // Warning: This allows production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: true,
  },
  images: {
    domains: ['images.unsplash.com', 'cdn.nba.com'],
    unoptimized: true,
  },
};

export default nextConfig; 
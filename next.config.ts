import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // Handle missing rdf-canonize-native module
    config.resolve.fallback = {
      ...config.resolve.fallback,
      'rdf-canonize-native': false,
    };

    // Ignore critical dependency warnings from componentsjs and yargs
    config.module = {
      ...config.module,
      exprContextCritical: false,
    };

    return config;
  },
};

export default nextConfig;

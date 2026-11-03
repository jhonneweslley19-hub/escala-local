import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals ?? []), { "node:sqlite": "commonjs node:sqlite" }];
    }
    return config;
  },
};

export default nextConfig;

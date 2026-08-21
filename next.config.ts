import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "qiniu"],
  transpilePackages: ["mp4box"],
  agentRules: false,
};

export default nextConfig;

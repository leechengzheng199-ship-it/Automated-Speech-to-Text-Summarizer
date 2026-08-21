import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "qiniu"],
  transpilePackages: ["mp4box"],
  agentRules: false,
};

export default nextConfig;

initOpenNextCloudflareForDev();

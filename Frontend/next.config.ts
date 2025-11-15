import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The floating dev badge sits on top of the UI in screenshots.
  devIndicators: false,
  eslint: { dirs: ["src", "tests"] },
};

export default nextConfig;

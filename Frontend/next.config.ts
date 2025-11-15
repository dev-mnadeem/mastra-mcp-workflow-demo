import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Docker image runs the traced standalone server instead of `next start`.
  output: "standalone",
  // The floating dev badge sits on top of the UI in screenshots.
  devIndicators: false,
  eslint: { dirs: ["src", "tests"] },
};

export default nextConfig;

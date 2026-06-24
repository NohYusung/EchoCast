import type { NextConfig } from "next";
import path from "node:path";

const workspaceRoot = path.basename(process.cwd()) === "front" ? path.resolve(process.cwd(), "..") : process.cwd();

const nextConfig: NextConfig = {
    output: "standalone",
    outputFileTracingRoot: workspaceRoot,
};

export default nextConfig;

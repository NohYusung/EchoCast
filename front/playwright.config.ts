import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const workspaceRoot = path.join(__dirname, "..");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3003",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "npm run build && node dist/main.js",
      cwd: path.join(workspaceRoot, "back"),
      url: "http://127.0.0.1:4100/products",
      timeout: 30_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command:
        "env NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:4100 npm run start --workspace @new-dubright/front -- -p 3003",
      cwd: workspaceRoot,
      url: "http://127.0.0.1:3003/studio/products/product-100/episodes/sample-player",
      timeout: 30_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});

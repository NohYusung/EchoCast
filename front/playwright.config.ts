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
      command: "node --import tsx src/main.ts",
      cwd: path.join(workspaceRoot, "back"),
      url: "http://127.0.0.1:4100/health",
      timeout: 30_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command:
        "env NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:4100 npm run start --workspace @test-player/front -- -p 3003",
      cwd: workspaceRoot,
      url: "http://127.0.0.1:3003/studio/products/product-100/episodes/sample-player",
      timeout: 30_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});

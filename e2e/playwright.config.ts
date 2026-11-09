import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  retries: 0,
  // All tests run against one shared dev database and the same admin login —
  // parallel workers race on shared entities (dropdown ordering, roster
  // contents, etc.), so keep this serial rather than chasing test-only flake.
  workers: 1,
  use: {
    baseURL: "http://localhost:5173",
    headless: true,
    screenshot: "only-on-failure",
  },
});

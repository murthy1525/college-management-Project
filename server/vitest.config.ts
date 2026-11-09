import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    fileParallelism: false, // tests share one Postgres database; run sequentially
    exclude: ["**/node_modules/**", "**/dist/**"],
    globalSetup: ["./src/tests/globalSetup.ts"],
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgres://postgres@127.0.0.1:5432/cms_test",
      JWT_ACCESS_SECRET: "test_access_secret",
      JWT_REFRESH_SECRET: "test_refresh_secret",
      JWT_ACCESS_EXPIRES_IN: "15m",
      JWT_REFRESH_EXPIRES_IN: "7d",
      CORS_ORIGIN: "http://localhost:5173",
      UPLOAD_DIR: "uploads-test",
      MAX_UPLOAD_MB: "5",
      SEED_ADMIN_EMAIL: "admin@cms.local",
      SEED_ADMIN_PASSWORD: "Admin@12345",
    },
  },
});

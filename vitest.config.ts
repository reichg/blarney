import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // next's "server-only" guard has no meaning in the test environment
      "server-only": fileURLToPath(
        new URL("./test/__mocks__/server-only.ts", import.meta.url),
      ),
    },
  },
});

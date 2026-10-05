import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bundlePath = path.resolve(__dirname, "server.bundle.js");

process.on("unhandledRejection", (reason) => {
  console.error("[ACMIS Server] Unhandled Promise Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[ACMIS Server] Uncaught Exception:", error);
});

async function ensureBundle() {
  if (!fs.existsSync(bundlePath)) {
    console.log(
      "[ACMIS SERVER] server.bundle.js not found, compiling on-the-fly with esbuild..."
    );

    try {
      const { build } = await import("esbuild");

      await build({
        entryPoints: [path.resolve(__dirname, "server-app.ts")],
        bundle: true,
        platform: "node",
        format: "esm",
        external: [
          "express",
          "cors",
          "pino",
          "pino-http",
          "vite",
          "pg",
          "drizzle-orm",
          "firebase-admin",
          "http-proxy-middleware",
        ],
        outfile: bundlePath,
      });

      console.log(
        "[ACMIS SERVER] server.bundle.js compiled successfully."
      );
    } catch (err) {
      console.error(
        "[ACMIS SERVER] Failed to compile server.bundle.js:",
        err
      );
    }
  }
}

async function main() {
  const isCloudRun = Boolean(
    process.env.K_SERVICE ||
      process.env.K_REVISION ||
      process.env.PORT === "8080"
  );

  /*
   * Development / Local mode -> ALWAYS use server-app.ts directly.
   * This avoids bundling Vite/http-proxy middleware during development.
   */
  if (!isCloudRun) {
    console.log("[ACMIS SERVER] Development mode: loading server-app.ts directly...");
    const { startServer } = await import("./server-app.ts");
    await startServer();
    return;
  }

  /*
   * Production / Cloud Run -> use the bundled server.
   */
  await ensureBundle();

  if (fs.existsSync(bundlePath)) {
    const bundleUrl = pathToFileURL(bundlePath).href;
    const { startServer } = await import(bundleUrl);
    await startServer();
  } else {
    const { startServer } = await import("./server-app.ts");
    await startServer();
  }
}

main().catch((err) => {
  console.error("Failed to start ACIMS server:", err);
  process.exit(1);
});
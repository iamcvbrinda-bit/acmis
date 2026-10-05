import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import cors from "cors";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";
import type { ServerResponse } from "node:http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function startServer() {
  const app = express();

  const portArgIndex = process.argv.indexOf("--port");
  const portArg =
    portArgIndex !== -1
      ? Number(process.argv[portArgIndex + 1])
      : null;

  const port =
    portArg ||
    Number(process.env.PORT) ||
    Number(process.env.DEFAULT_APP_PORT) ||
    3000;

  // Detect distribution folder if built
  const candidatePaths = [
    path.resolve(__dirname, "artifacts/acims/dist"),
    path.resolve(process.cwd(), "artifacts/acims/dist"),
    path.resolve(__dirname, "dist"),
    path.resolve(process.cwd(), "dist"),
  ];

  const distPath = candidatePaths.find((p) =>
    fs.existsSync(path.join(p, "index.html"))
  );

  const isCloudRun = Boolean(
    process.env.K_SERVICE ||
      process.env.K_REVISION ||
      process.env.PORT === "8080"
  );

  const isDev =
    !isCloudRun &&
    (!distPath ||
      process.env.NODE_ENV !== "production" ||
      process.env.npm_lifecycle_event === "dev");

  app.use(cors());

  // Health checks
  const healthCheck = (
    _req: express.Request,
    res: express.Response
  ) => {
    res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
    });
  };

  app.get("/health", healthCheck);
  app.get("/healthz", healthCheck);
  app.get("/_ah/health", healthCheck);
  app.get("/live", healthCheck);
  app.get("/ready", healthCheck);

  /*
   * DEVELOPMENT API PROXY
   *
   * The real ACMIS backend is running on port 3001.
   * The frontend runs on port 3000.
   *
   * Target is set to http://localhost:3001/api so that requests
   * like /api/buses forward to http://localhost:3001/api/buses.
   *
   * Mounted BEFORE express.json() so request body streams
   * (e.g. POST /api/buses/:busId/location) are not consumed before proxying.
   */
  if (!isCloudRun) {
    console.log(
      "[ACMIS Server] Proxying /api requests to http://localhost:3001/api"
    );

    app.use(
      "/api",
      createProxyMiddleware({
        target: "http://localhost:3001/api",
        changeOrigin: true,
        ws: true,
        on: {
          proxyReq: fixRequestBody,
          error: (err, _req, res) => {
            console.error("[ACMIS Proxy Error]", (err as Error).message);
            const serverRes = res as ServerResponse | undefined;
            if (
              serverRes &&
              typeof serverRes.writeHead === "function" &&
              !serverRes.headersSent
            ) {
              serverRes.writeHead(502, {
                "Content-Type": "application/json",
              });
              serverRes.end(
                JSON.stringify({
                  error: "Bad Gateway",
                  message:
                    "Failed to connect to backend on http://localhost:3001",
                })
              );
            }
          },
        },
      })
    );
  }

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  if (distPath && !isDev) {
    console.log(
      `Serving static production build from ${distPath}`
    );

    app.use(express.static(distPath));

    app.use((_req, res) => {
      const indexPath = path.join(
        distPath,
        "index.html"
      );

      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res
          .status(404)
          .send("Application build artifacts not found.");
      }
    });
  } else if (isCloudRun) {
    console.warn(
      "Production build artifacts not found, serving status fallback page."
    );

    app.use((_req, res) => {
      res.status(200).send(
        "<!DOCTYPE html>" +
          "<html>" +
          "<head><title>ACMIS Mobility System</title></head>" +
          "<body>" +
          "<h1>ACMIS Mobility System</h1>" +
          "<p>Service active. API available at /api.</p>" +
          "</body>" +
          "</html>"
      );
    });
  } else {
    console.log(
      "Starting in development mode with Vite middleware"
    );

    const { createServer: createViteServer } =
      await import("vite");

    const vite = await createViteServer({
      configFile: path.resolve(
        __dirname,
        "artifacts/acims/vite.config.ts"
      ),
      server: {
        middlewareMode: true,
        host: "0.0.0.0",
      },
      appType: "spa",
      root: path.resolve(
        __dirname,
        "artifacts/acims"
      ),
    });

    app.use(vite.middlewares);
  }

  return new Promise((resolve, reject) => {
    const server = app.listen(
      port,
      "0.0.0.0",
      () => {
        console.log(
          `ACIMS Mobility System server listening on http://0.0.0.0:${port}`
        );
        resolve(server);
      }
    );

    server.on("error", (err: any) => {
      console.error(
        `[ACMIS Server] Server listen error on port ${port}:`,
        err
      );

      if (
        err.code === "EADDRINUSE" &&
        port !== 3000
      ) {
        console.warn(
          `[ACMIS Server] Port ${port} is already in use, attempting fallback to port 3000...`
        );

        const fallbackServer = app.listen(
          3000,
          "0.0.0.0",
          () => {
            console.log(
              "ACIMS Mobility System server listening on fallback http://0.0.0.0:3000"
            );

            resolve(fallbackServer);
          }
        );

        fallbackServer.on(
          "error",
          (fallbackErr) => {
            reject(fallbackErr);
          }
        );
      } else {
        reject(err);
      }
    });

    const shutdown = () => {
      console.log(
        "Shutting down server gracefully..."
      );

      server.close(() => {
        console.log("Server closed.");
        process.exit(0);
      });
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  });
}

import { Hono } from "hono";
import healthRoute from "./routes/health";
import importCacheRoute from "./routes/importCache";
import marketRoute from "./routes/market";
import optionsRoute from "./routes/options";
import recommendationsRoute from "./routes/recommendations";
import refreshRoute from "./routes/refresh";
import statusRoute from "./routes/status";
import type { AppBindings } from "./types/env";

const app = new Hono<AppBindings>();

app.route("/api/health", healthRoute);
app.route("/api/import-cache", importCacheRoute);
app.route("/api/market/latest", marketRoute);
app.route("/api/options", optionsRoute);
app.route("/api/recommendations", recommendationsRoute);
app.route("/api/status", statusRoute);
app.route("/api/refresh", refreshRoute);

app.onError((error, c) => {
  console.error(error);

  return c.json(
    {
      ok: false,
      message: error instanceof Error ? error.message : "Unexpected error"
    },
    500
  );
});

app.notFound((c) => {
  return c.json(
    {
      ok: false,
      message: `Route not found: ${c.req.path}`
    },
    404
  );
});

export default {
  fetch: app.fetch
};

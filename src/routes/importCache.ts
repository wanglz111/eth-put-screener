import { Hono } from "hono";
import { persistSnapshotBundle } from "../storage/snapshots";
import type { AppBindings } from "../types/env";
import type { SnapshotBundle } from "../types/market";

const importCacheRoute = new Hono<AppBindings>();

function isSnapshotBundle(payload: unknown): payload is SnapshotBundle {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Record<string, unknown>;
  return Boolean(candidate.market && candidate.options && candidate.recommendations && candidate.status);
}

importCacheRoute.post("/", async (c) => {
  const expectedToken = c.env.CACHE_IMPORT_TOKEN ?? c.env.MANUAL_REFRESH_TOKEN;
  if (!expectedToken) {
    return c.json(
      {
        ok: false,
        message: "CACHE_IMPORT_TOKEN or MANUAL_REFRESH_TOKEN is not configured."
      },
      403
    );
  }

  const authorization = c.req.header("authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "");

  if (token !== expectedToken) {
    return c.json(
      {
        ok: false,
        message: "Unauthorized"
      },
      401
    );
  }

  const payload = await c.req.json();
  if (!isSnapshotBundle(payload)) {
    return c.json(
      {
        ok: false,
        message: "Invalid snapshot payload."
      },
      400
    );
  }

  await persistSnapshotBundle(c.env, payload);

  return c.json({
    ok: true,
    data: {
      importedAt: new Date().toISOString(),
      recommendations: payload.recommendations.items.length,
      options: payload.options.items.length
    }
  });
});

export default importCacheRoute;

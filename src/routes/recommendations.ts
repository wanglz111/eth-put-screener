import { Hono } from "hono";
import { getLatestRecommendations } from "../storage/kv";
import type { AppBindings } from "../types/env";

const recommendationsRoute = new Hono<AppBindings>();

recommendationsRoute.get("/", async (c) => {
  const payload = await getLatestRecommendations(c.env);
  const limit = Number(c.req.query("limit") ?? "3");

  if (!payload) {
    return c.json(
      {
        ok: false,
        message: "No recommendations available yet. Run the cron job or POST /api/refresh."
      },
      503
    );
  }

  return c.json({
    ok: true,
    data: {
      ...payload,
      items: payload.items.slice(0, Number.isFinite(limit) ? Math.max(limit, 0) : 3)
    }
  });
});

export default recommendationsRoute;


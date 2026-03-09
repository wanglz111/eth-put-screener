import { Hono } from "hono";
import { getLatestMarket } from "../storage/kv";
import type { AppBindings } from "../types/env";

const marketRoute = new Hono<AppBindings>();

marketRoute.get("/", async (c) => {
  const market = await getLatestMarket(c.env);

  if (!market) {
    return c.json(
      {
        ok: false,
        message: "No market snapshot available yet. Run the cron job or POST /api/refresh."
      },
      503
    );
  }

  return c.json({
    ok: true,
    data: market
  });
});

export default marketRoute;


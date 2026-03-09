import { Hono } from "hono";
import { getLatestOptions } from "../storage/kv";
import type { AppBindings } from "../types/env";

const optionsRoute = new Hono<AppBindings>();

optionsRoute.get("/", async (c) => {
  const payload = await getLatestOptions(c.env);

  if (!payload) {
    return c.json(
      {
        ok: false,
        message: "No options snapshot available yet. Run the cron job or POST /api/refresh."
      },
      503
    );
  }

  return c.json({
    ok: true,
    data: payload
  });
});

export default optionsRoute;

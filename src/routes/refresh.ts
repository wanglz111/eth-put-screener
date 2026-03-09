import { Hono } from "hono";
import { refreshMarketData } from "../jobs/refreshMarketData";
import type { AppBindings } from "../types/env";

const refreshRoute = new Hono<AppBindings>();

refreshRoute.post("/", async (c) => {
  const expectedToken = c.env.MANUAL_REFRESH_TOKEN;
  if (!expectedToken) {
    return c.json(
      {
        ok: false,
        message: "MANUAL_REFRESH_TOKEN is not configured."
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

  const result = await refreshMarketData(c.env);
  return c.json({
    ok: true,
    data: result
  });
});

export default refreshRoute;


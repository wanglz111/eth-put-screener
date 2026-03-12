import { Hono } from "hono";
import { refreshMarketData } from "../jobs/refreshMarketData";
import type { AppBindings } from "../types/env";

const refreshRoute = new Hono<AppBindings>();

const RATE_LIMIT_KEY = "manual_refresh_last_time";
const RATE_LIMIT_SECONDS = 60;

refreshRoute.post("/", async (c) => {
  // 检查限流
  const lastRefreshTime = await c.env.OPTION_PUT_CACHE.get(RATE_LIMIT_KEY);
  const now = Date.now();

  if (lastRefreshTime) {
    const lastTime = parseInt(lastRefreshTime, 10);
    const elapsedSeconds = (now - lastTime) / 1000;

    if (elapsedSeconds < RATE_LIMIT_SECONDS) {
      const remainingSeconds = Math.ceil(RATE_LIMIT_SECONDS - elapsedSeconds);
      return c.json(
        {
          ok: false,
          message: `Rate limit: please wait ${remainingSeconds} seconds before refreshing again.`,
          remainingSeconds
        },
        429
      );
    }
  }

  // 更新最后刷新时间
  await c.env.OPTION_PUT_CACHE.put(RATE_LIMIT_KEY, now.toString());

  const result = await refreshMarketData(c.env);
  return c.json({
    ok: true,
    data: result
  });
});

export default refreshRoute;


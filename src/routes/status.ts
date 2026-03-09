import { Hono } from "hono";
import { getRefreshStatus } from "../storage/kv";
import type { AppBindings } from "../types/env";

const statusRoute = new Hono<AppBindings>();

statusRoute.get("/", async (c) => {
  const status = await getRefreshStatus(c.env);

  if (!status) {
    return c.json(
      {
        ok: false,
        message: "No refresh status available yet."
      },
      503
    );
  }

  return c.json({
    ok: true,
    data: status
  });
});

export default statusRoute;


import { Hono } from "hono";
import type { AppBindings } from "../types/env";

const healthRoute = new Hono<AppBindings>();

healthRoute.get("/", (c) => {
  return c.json({
    ok: true,
    time: new Date().toISOString()
  });
});

export default healthRoute;


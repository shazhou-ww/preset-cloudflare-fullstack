import { authHandler, initAuthConfig, verifyAuth } from "@hono/auth-js";
import type { Session } from "@auth/core/types";
import type {
  BootstrapResponse,
  HealthResponse,
  SessionResponse,
} from "@workspace/contracts";
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";

import { createAuthConfig, getConfiguredProviders } from "./auth.js";
import type { Bindings } from "./env.js";

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", secureHeaders());
app.use(
  "*",
  initAuthConfig((context) => createAuthConfig(context.env as Bindings)),
);

app.use("/api/auth/*", authHandler());

app.get("/api/health", (context) =>
  context.json<HealthResponse>({
    service: context.env.APP_NAME,
    status: "ok",
  }),
);

app.get("/api/bootstrap", (context) =>
  context.json<BootstrapResponse>({
    appName: context.env.APP_NAME,
    providers: getConfiguredProviders(context.env),
  }),
);

app.use("/api/me", verifyAuth());
app.get("/api/me", (context) => {
  const session = context.get("authUser").session;
  return context.json(toSessionResponse(session));
});

app.notFound((context) =>
  context.json(
    {
      error: "Not found",
    },
    404,
  ),
);

export default app;

export function toSessionResponse(session: Session): SessionResponse {
  return {
    expires: session.expires,
    ...(session.user ? { user: session.user } : {}),
  };
}

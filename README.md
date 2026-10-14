# Cloudflare fullstack preset

A production-shaped Cloudflare starter with a React interface, a Hono Worker,
same-origin static assets, and Auth.js sign-in through GitHub, Google, and
Microsoft Entra ID.

The included **Signal Desk** interface is intentionally concrete enough to
exercise authentication and deployment. Replace its name and visual language
when deriving a product.

## Derive a repository

```sh
git-lineage derive \
  https://github.com/shazhou-ww/preset-cloudflare-fullstack.git \
  my-service \
  --branch main
cd my-service
pnpm install
```

This preset derives from
[`preset-pnpm-monorepo`](https://github.com/shazhou-ww/preset-pnpm-monorepo).
Its `.git-lineage.yaml` tracks that immediate parent. Run `git-lineage update`
to merge later monorepo baseline changes. This preset documents its own
capabilities and does not enumerate descendants.

## Architecture

```text
apps/
  web/          React + Vite interface
  worker/       Hono API, Auth.js, static asset deployment
packages/
  contracts/    request and response contracts shared by both apps
```

Cloudflare serves `apps/web/dist` as static assets. Requests under `/api/*` run
the Worker first. Every other unknown route falls back to `index.html`, so
client-side routes remain deployable without a second service.

The Worker package declares the web package as a workspace dependency. This is
deployment topology rather than a runtime import: Turborepo builds web assets
before validating or deploying the Worker.

## Local development

Create the local secret file:

```sh
cp apps/worker/.dev.vars.example apps/worker/.dev.vars
```

Generate `AUTH_SECRET` with a cryptographically secure random value:

```sh
openssl rand -base64 32
```

Then run:

```sh
pnpm dev
```

- React development server: `http://localhost:5173`
- Worker development server: `http://localhost:8787`
- Vite proxies `/api/*` to the Worker.

`AUTH_URL` in `.dev.vars.example` points to the proxied browser origin. This
keeps OAuth callbacks and session cookies on `localhost:5173`.

## Identity providers

At least one provider needs credentials. Providers without both an ID and secret
are omitted from the interface rather than exposed as broken actions.

### GitHub

Create an OAuth App and use:

```text
Homepage URL: http://localhost:5173
Authorization callback URL:
http://localhost:5173/api/auth/callback/github
```

Set `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET`.

### Google

Create an OAuth 2.0 Web application with:

```text
Authorized JavaScript origin: http://localhost:5173
Authorized redirect URI:
http://localhost:5173/api/auth/callback/google
```

Set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.

### Microsoft Entra ID

Create a Web platform redirect URI:

```text
http://localhost:5173/api/auth/callback/microsoft-entra-id
```

Set `AUTH_MICROSOFT_ENTRA_ID_ID`, `AUTH_MICROSOFT_ENTRA_ID_SECRET`, and
optionally `AUTH_MICROSOFT_ENTRA_ID_ISSUER`. The example issuer accepts accounts
from any Entra tenant. Replace `common` with a tenant ID for a single-tenant
app.

Use the production origin in every provider console before deployment.

## Worker secrets

Set production values from the Worker workspace:

```sh
pnpm --filter @workspace/worker exec wrangler secret put AUTH_SECRET
pnpm --filter @workspace/worker exec wrangler secret put AUTH_URL
pnpm --filter @workspace/worker exec wrangler secret put AUTH_GITHUB_ID
pnpm --filter @workspace/worker exec wrangler secret put AUTH_GITHUB_SECRET
```

Repeat the last two commands for Google or Microsoft variables. `AUTH_URL` must
be the full production auth base, for example:

```text
https://example.com/api/auth
```

Never commit `.dev.vars`; only `.dev.vars.example` belongs in Git.

## Commands

| Command       | Purpose                                                      |
| ------------- | ------------------------------------------------------------ |
| `pnpm dev`    | Build initial assets, then run Vite and Wrangler             |
| `pnpm check`  | Format, lint, type-check, test, and dry-run the Worker build |
| `pnpm build`  | Build the contracts, web assets, and Worker bundle           |
| `pnpm deploy` | Validate everything and deploy the Worker plus assets        |
| `pnpm clean`  | Remove all generated outputs                                 |

## Continuous deployment

The deploy workflow is safe to inherit because push deployment is disabled by
default. Configure the `production` GitHub environment with:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Set the repository variable `CLOUDFLARE_DEPLOY_ENABLED=true` to deploy every
push to `main`. A manual workflow dispatch always attempts a deployment.

Use a narrowly scoped Cloudflare token that can edit Workers scripts for the
target account.

## Before shipping a derived app

1. Change the package and repository metadata.
2. Change the Worker name and compatibility date in
   `apps/worker/wrangler.jsonc`.
3. Replace Signal Desk content, metadata, and branding.
4. Configure production callback URLs and secrets.
5. Review the protected API routes and add application authorization.
6. Enable the deployment workflow only after its environment is configured.

## License

MIT

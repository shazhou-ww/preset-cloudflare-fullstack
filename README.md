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

| Command          | Purpose                                                      |
| ---------------- | ------------------------------------------------------------ |
| `pnpm dev`       | Build initial assets, then run Vite and Wrangler             |
| `pnpm build`     | Build the contracts, web assets, and Worker bundle           |
| `pnpm lint`      | Lint release scripts and every workspace                     |
| `pnpm typecheck` | Type-check every workspace                                   |
| `pnpm test`      | Test release guards and workspaces with coverage             |
| `pnpm check`     | Format, lint, type-check, test, and dry-run the Worker build |
| `pnpm deploy`    | Build and deploy the Worker plus assets                      |
| `pnpm clean`     | Remove workspace outputs and Turborepo state                 |

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

## Add a workspace

Every direct child of `apps/` or `packages/` is discovered automatically. Give
it a unique package name and the standard scripts consumed by `turbo.json`. Keep
application packages private. Libraries opt in to the package-specific tag
release workflow below; examples remain private until deliberately configured.

## Publish one package

Publishing is opt-in. The root, apps, and contracts workspace remain private.
There is no automatic batch release or automatic version bumping.

### Configure a derived repository

1. Replace the contracts library's name and metadata. In
   `scripts/release-packages.js`, map its unique package ID to the exact npm
   name and `packages/<directory>`. For example, `contracts` can map to
   `@your-scope/contracts`. Update workspace consumers when renaming the
   library.
2. Only for a library ready to publish, remove `private: true`, add
   `"files": ["dist", "README.md", "LICENSE"]`, and set
   `"publishConfig": { "access": "public", "registry": "https://registry.npmjs.org/" }`.
   Include the library's README and license in its directory. Keep apps private.
3. Configure an `npm` GitHub environment and an npm Trusted Publisher for each
   package, using the exact owner, repository, `publish-npm.yaml` workflow, and
   `npm` environment. Do not configure an `NPM_TOKEN`.
4. Keep each library's `build` script aligned with Turborepo. Publishing builds
   the selected library and its workspace dependencies, then packs only that
   library with lifecycle hooks disabled. Put required generation in `build`,
   not in `prepack`, `prepare`, or publishing hooks.

### Release a version

Manually update the selected library's version and any affected internal
dependency versions. Commit these changes to main and wait for that exact
commit's main push CI, including **Release verification (v1)**, to succeed. Then
explicitly create and push its package-specific tag:

```sh
git tag contracts-v1.2.3 <verified-main-commit>
git push origin contracts-v1.2.3
```

The tag publishes only the mapped package. Both the tagged manifest and the
tarball must match its exact name and version; the root version is irrelevant.
Unknown package IDs, private/placeholder names, invalid versions, mismatches,
unresolved local dependencies, and already-published versions block release.
Canonical stable SemVer versions and `x.y.z-rc.n` prerelease versions are
supported (without build metadata). Stable versions use npm's `latest` tag;
prereleases use `rc`. For each target `x.y.z` version, start `n` at `0` and
increment it by one for each subsequent prerelease: `1.2.3-rc.0`, `1.2.3-rc.1`,
and so on. Use matching package-specific Git tags, for example
`core-v1.2.3-rc.0`.

The pinned `github-ci-verify` CLI requires the latest `ci.yaml` main push run
for the exact checked-out SHA and its successful versioned aggregate job and
step. Missing, pending, skipped, failed, or inaccessible evidence blocks
publication. Changing the validation contract requires updating both the CI
aggregate and the publish verifier arguments. Publishing does not rerun
`pnpm check`.

`pnpm pack` converts `workspace:*` to registry versions. Internal runtime,
optional, and peer dependency ranges must already resolve to published npm
versions. Missing dependencies must be released with their own tags first;
building dependencies never publishes them. The workflow packs once, verifies
the tarball's manifest and dependencies, runs publint on it, and publishes that
same artifact through npm OIDC.

### Validate without publishing

After the configured commit's main push CI succeeds:

```sh
gh workflow run publish-npm.yaml --ref main -f package=contracts
```

Manual runs only perform an npm dry run, never an actual publish or dist-tag
update. All metadata, CI, artifact, and dependency checks still apply; only the
already-published-version rejection is omitted. A dry run is not proof of a
successful real OIDC publication.

Release tags are immutable. If CI has not completed, wait and retry the failed
workflow without moving the tag. Do not retry an already-successful publication;
an existing npm version is rejected. Automatic rollback, batch publishing,
version management, and dependency publication are deliberately out of scope.

## License

MIT

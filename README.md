# What Would My Character Do?

A mobile D&D 5e combat assistant hosted at **https://help.dndadventurerslog.com**
using Cloudflare Workers and Workers Static Assets.

## Local development

Requires Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Open the local address printed by Wrangler. Character data and settings are
stored in the browser. AI features support visitor-supplied Groq and OpenAI keys
through AI Options. A PHP installation is not required for the Worker.

## Deploy to Cloudflare

1. In Cloudflare **Workers & Pages**, create a **Worker** connected to
   `mmmbeer/wwmcd`.
2. Use these build settings:

   | Setting | Value |
   | --- | --- |
   | Production branch | `main` (after merging the migration) |
   | Root directory | Repository root |
   | Build command | `npm run build` |
   | Deploy command | `npm run deploy` |
   | Worker name | `wwmcd` |

   Wrangler also runs the asset build before deployment and local development.
   Do not select a Pages project or set a Pages output directory.
3. Deploy. `wrangler.jsonc` attaches the Custom Domain
   `help.dndadventurerslog.com`. The `dndadventurerslog.com` zone must be active
   in the same Cloudflare account. Cloudflare provisions the DNS record and TLS
   certificate for this hostname. If a conflicting DNS record for **help**
   already exists, remove that conflicting record before retrying. Leave the
   apex and `www` records for the main site alone.
4. Verify `/api/health` returns `{"ok":true,"service":"wwmcd"}` and check that
   the app loads its CSS, JavaScript modules, images, and reference data.

Alternatively deploy from a local checkout:

```sh
npm ci
npx wrangler login
npm run deploy
```

The standard `wwmcd.<account-subdomain>.workers.dev` address remains available
for troubleshooting. No D1, KV, R2, database migration, or account ID in source
is required.

## AI configuration

The Worker supports `/api/ai.php`, `/api/ai`, and the legacy `/api/groq.php`
route. Existing browser clients continue to use the same JSON contracts.

Visitor keys take precedence. Optional server keys can be stored as Worker
secrets with `npx wrangler secret put NOTWITHSTANDING_GROQ_API_KEY` or
`npx wrangler secret put NOTWITHSTANDING_OPENAI_API_KEY`. These secrets make AI
requests available to all visitors, so omit them when each visitor should
supply their own key. The existing UI still expects a key in AI Options before
enabling AI recommendations.

Optional `NOTWITHSTANDING_GROQ_BASE_URL` and `NOTWITHSTANDING_OPENAI_BASE_URL`
Worker variables override provider endpoints for a trusted gateway. For local
development, put settings in a gitignored `.dev.vars` file. Never place keys
in browser JavaScript, `wrangler.jsonc`, or committed files.

PHP endpoints remain in the repository for older PHP hosting. They are excluded
from Worker assets along with documentation, tests, configuration, and secrets.

## Verification

```sh
npm test
npm run deploy:check
```

`deploy:check` builds assets and validates Worker packaging without publishing.
See [the deployment test checklist](docs/cloudflare-deployment.md) for smoke tests.

# Cloudflare deployment checks

The Worker serves static files from `dist/` and handles `/api/*` before assets.
Missing files return 404 rather than HTML masquerading as a module or JSON.
The app uses its root document rather than browser history routes, so no SPA
fallback is required.

## Before publishing

1. Run `npm ci`, `npm test`, and `npm run deploy:check`.
2. Run `npm run dev` and open the app at desktop and 390px mobile widths.
3. Import a character. Verify the character summary, actions, rolls, and rest
   controls. Reload and verify local character/combat persistence.
4. Check `/api/health`, `/css/player-combat.css`,
   `/js/player-combat/bootstrap.js`, `/assets/favicon.png`, and
   `/data/conditions.json` all respond with the correct content types.
5. Check `/api/missing`, `/js/missing.js`, `/AGENTS.md`, `/api/ai-config.local.php`,
   and `/worker/index.mjs` return 404. No server source or local secrets should
   be in `dist/`.
6. Open AI Options. With a visitor Groq key, fetch models and generate a combat
   plan. Repeat with OpenAI. Verify errors appear in the existing modal when a
   key is invalid. Unit tests mock providers and never spend API credits.
7. After deployment, repeat the asset and health checks on the custom domain
   and confirm HTTPS works after certificate provisioning completes.

## Migration limitations

- Deployment and DNS require access to the Cloudflare account that owns the
  zone. Repository changes alone do not publish a Worker.
- Browser storage is specific to an origin. Characters saved on an older
  hostname do not automatically appear on `help.dndadventurerslog.com`.
  Re-import the original character PDF on the new hostname. Keep the old origin
  available if you still need to read combat state stored there.
- AI request data is sent to the selected provider. API keys are forwarded in
  authorization headers and AI responses use `Cache-Control: no-store`.
- Original PHP hosting still uses the original PHP files. Worker changes should
  be tested through Wrangler, not a static file server or PHP server.

## Cloudflare references

- https://developers.cloudflare.com/workers/static-assets/
- https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- https://developers.cloudflare.com/workers/ci-cd/builds/configuration/

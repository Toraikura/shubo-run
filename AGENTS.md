# SHUBO RUN development agreements

- GitHub is the canonical source and history for this game: https://github.com/Toraikura/shubo-run. Before editing, fetch and inspect the current remote branch and local changes; never overwrite another environment's work. Work locally as a checkout, then commit/push finished authorized work. Use branches/PRs for reviewable changes unless direct main publishing is requested.
- Read README.md and docs/HANDOFF.md. Preserve the playable baseline v1.0.0. This repository is independent of SAKE CLASH and the parent website.
- Primary design target is iPhone portrait and touch/thumb interaction. Keyboard is secondary. Keep all play controls visible without scrolling and consider safe areas, Safari toolbars, accidental gestures and pause/resume.
- Preserve science facts, educational simplifications and fictional coefficients as distinct categories. No real brewing safety claims. New science needs primary-source verification.
- No ads, payment, accounts, telemetry or external DB without a new request.
- Validate with npm ci; npm run lint; npm run typecheck; npm test; npm run build. Browser tests: npx playwright install --with-deps chromium; npm run test:e2e -- --workers=3.
- Browser viewport emulation is not real iPhone Safari testing. Report testing scope honestly.
- main automatically publishes this game through GitHub Pages after CI. Do not modify the other game's repository or any parent site's publishing settings.

- v2 adds fever collection multiplier, inter-wave support and seeded connected layouts. Keep classic seed260907 route stable and test nonclassic seeds for connectivity. Preserve legacy records when changing preferences.
- scripts/verify-webkit.mjs (if present) tests desktop WebKit with touch emulation, never real iPhone Safari. Keep engine-specific CDP touch tests in Chromium.

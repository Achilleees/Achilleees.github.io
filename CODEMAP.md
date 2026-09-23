# Personal site map

This repository independently owns the Roubiniol personal directory for `https://achille.roubiniol.eu/`, intended for `Achilleees/Achilleees.github.io`. It contains one Sidearm card and Achille/GitHub contact, with no biography, speculative entries or contact collection. The homepage remains script-free while audience measurement is disabled.

| Path | Contract |
|---|---|
| `content/site.json` | Directory copy, GitHub contact and explicit email-verification flag |
| `src/index.html`, `src/styles.css` | Responsive paper/ink/orange directory |
| `scripts/graphics.mjs` | Provisional geometric R and Sidearm bicep card mark |
| `scripts/site-config.mjs` | Fixed personal/Sidearm origins and local outputs |
| `scripts/build.mjs`, `scripts/check.mjs` | Escaped deterministic render and structure/asset/contact checks |
| `content/analytics.json` | Disabled measurement configuration and verified server gate |
| `scripts/privacy.mjs`, `scripts/check-privacy.mjs` | Privacy generation and output checks |
| `src/privacy.html`, `src/privacy.css`, `src/privacy.js` | Local privacy page and origin-scoped preference |
| `src/analytics.js`, `src/tests/` | Guarded optional tracker and meaningful exclusion/build tests |
| `public/` | Fonts, font licenses, favicon, site license and `.nojekyll` |
| `.github/workflows/check.yml` | Independent production/preview checks; uploads only `dist/` and deploys only from `main` outside pull requests |

## Local work

Use Node 24 or later from this repository:

```sh
node scripts/build.mjs
node scripts/check.mjs
node scripts/build.mjs --preview
node scripts/check.mjs --preview
python -m http.server 4192 --bind 127.0.0.1 --directory preview
```

`dist/` is production output; `preview/` is noindex local output linking to Sidearm on 4191. Both are ignored. No build reads the Sidearm website repository. Unknown CLI options and linked output paths are rejected. Each generated output independently stays under 461120 bytes.

`contact.emailVerified` is false until Org-Rename confirms send/receive and authentication. False omits both the mailbox text and mailto link; GitHub remains usable. `content/analytics.json` likewise stays disabled until the server, IDs and privacy policy are verified. Preview builds never emit an analytics script.

## Measurement and privacy

`/privacy/` explains the current enabled/disabled state and saves a local browser choice per hostname. No remote control or readiness request is used. The optional Matomo bootstrap requires an exact HTTPS origin, explicit receipt and positive safe site ID, then excludes opt-out, unavailable storage, DNT and GPC. Delayed callbacks recheck those exclusions. It sends only authored page identity, sanitized referrer origin and one fixed destination label for a project-link action; navigation never waits.

Activation requires Matomo >= 5.1 and Org-Rename's verified server controls: exact hostname restrictions, separate IDs, no cross-site identification, IP/referrer handling, disabled individual profiles/session recordings, 180-day retention and reviewed CNIL requirements. Cookieless tracking alone does not prove exemption. Tracking cookies, feature/performance data and campaign/query/hash data are disabled or excluded. Opt-out may add a necessary Matomo preference cookie when active. The related Sidearm hostname has an independent preference, linked from this page.

The source validates the activation booleans and positive safe site ID. `serverVerified` records Org-Rename's operational verification; the build does not inspect the Matomo version, retention or server settings. Those controls are release-policy requirements, separate from the local configuration checks.

Privacy source is intentionally maintained in each independent deployment repository. Apply and test protocol changes in both copies; no shared external build dependency is required.

## Acceptance

Run production and preview build/check when build inputs change; the checks include privacy source/build coverage. Use checks proportional to the change and retain existing evidence for unchanged output. Optional measurement activation has its own verification and is not a launch prerequisite.

Publication acceptance is Achille reviewing the actual candidate on phone and desktop, then giving his explicit go. The launch uses the existing provisional geometric R and keeps the Sidearm card identity. No further identity exploration, five-viewer check, second-browser coverage or native zoom/motion gate is required. Record acceptance and any requested changes on the canonical progress board. Org-Rename configures GitHub Actions as the Pages source, verifies `achille.roubiniol.eu`, restricts the `github-pages` environment to `main`, and coordinates publication only after that explicit go. Every push, main promotion, publication or deployment remains held until then. The workflow checks production and preview output for `dev`, `main` and pull requests; only a non-pull-request run on `main` uploads `dist/` and deploys it. Deployment waits for the checks and receives Pages/OIDC write permissions only in its own job. Local builds and a prepared workflow do not establish a live deployment.

The accepted apex arrangement is an OVH no-store 302 from `roubiniol.eu` and `www` to Sidearm, activated after the Sidearm destination is healthy. Initial site publication can retain disabled measurement and hidden domain email; their separate verification gates control later activation.

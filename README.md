# exnulla-demos

Tier-2 static iframe demos for exnulla.com.

## Contract

- Each demo lives in `apps/<slug>/`
- Build output is `apps/<slug>/dist/index.html`
- All assets must resolve under `/demos/<slug>/` when embedded
  - Vite demos use `base: "./"`

## Tooling

- pnpm workspaces
- Turborepo pipeline: format -> typecheck -> test -> build
- CI runs `pnpm ci:gate`

## Integration

`exnulla-site` pins a commit SHA of this repo in `demos/manifest.json`, builds at that SHA, and copies demo `dist/` into `site/public/demos/<slug>/`.

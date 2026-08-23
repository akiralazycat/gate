# @akiralazycat/gate

Shared primitives behind Gate.

```ts
import { gateThemeToCss, normalizeGateTheme } from "@akiralazycat/gate/theme";
```

The package currently exposes:

- versioned Gate theme schema, presets, normalization and JSON/CSS export
- expiring and limited-use access-code primitives
- an in-memory development code store
- a Redis-compatible atomic code store adapter

The repository app is the reference Next.js integration. Publishing is intentionally separate from the app deploy: run `npm run build:package`, inspect `packages/gate/dist`, then publish from `packages/gate` when the npm scope is configured.

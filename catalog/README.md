<!-- AUTHORED-BY Claude Fable 5 -->

# spec-companion catalog (phase 2)

A central, queryable index of **every landed machine-readable companion** across the
@jeswr specification family — the phase-2 deliverable of the design
([`../docs/DESIGN.md`](../docs/DESIGN.md) §6 "a central *catalog* … is a natural
phase-2 here" and §9 follow-up 6).

| File | What |
|---|---|
| [`companions.ttl`](./companions.ttl) | The catalog as data: a **DCAT** `dcat:Catalog` with one `dcat:Dataset` per companion (title, the spec it is `sc:companionOf`, its `sc:specVersion` pin, statement count via `void:entities`, and a `dcat:distribution` pointing at the companion's published Turtle). Queryable cross-spec. |
| [`companions.md`](./companions.md) | The same, rendered as a human table with per-companion coverage (statements / MUST / test-covered / test gaps). |

## By reference, never by copy

The catalog **points at** each companion's published URL; it never copies companion
content. The companion in its own spec repo stays the single source of truth (design
§6), so the catalog can never become a drifting second copy — it only ever holds
metadata + a link. Per-statement detail (verbatim quotes, levels, testability tags,
anchors, the actual `spec:testCase`/`sc:testGap`) is read from the companion itself.

## Regenerating

```bash
cd tools
npm run catalog          # rewrite companions.ttl + companions.md from the companions
npm run catalog:check    # validate the committed companions.ttl (no siblings needed)
```

`catalog` scans for `*/*.statements.ttl` under the parent of this repo (the sibling
@jeswr checkouts); override the scan root with `$SPEC_COMPANION_ROOT`. It is a
**maintenance** step — like the companions themselves, the committed catalog is static
data. `catalog:check` re-parses the committed `companions.ttl` and asserts it is a
well-formed DCAT catalog (every dataset has a title, an `sc:specVersion`, an
`sc:companionOf`, and a distribution with a download URL); it needs no sibling
checkouts and runs in the base gate (`npm test`).

## Adding a companion

Land the companion in its spec's own repo (per the rollout in
[`../README.md`](../README.md)), check that repo out beside this one, and run
`npm run catalog` — a new `*.statements.ttl` is discovered automatically; there is no
hand-maintained membership list.

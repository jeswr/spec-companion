<!-- AUTHORED-BY Claude Fable 5 -->

# spec-companion

**Machine-readable, guardrailed companions for the @jeswr specification family.**
Each spec keeps its full text unchanged and gains a sidecar Turtle graph
(`spec.statements.ttl`) enumerating its normative statements — stable id, verbatim quote,
RFC 2119 level, actor binding, testability tag (E / A-int / A-exist / P), section anchor,
and conformance-vector links or an honest test gap — validated by a strict SHACL
"spec-of-specs" shape plus a deterministic checker.

The model is the one the Solid ecosystem already uses: the Solid Protocol embeds its 94
requirements as RDFa over [`http://www.w3.org/ns/spec#`](https://www.w3.org/ns/spec), and
the Solid conformance test harness references those requirement IRIs from its test
manifests. This repo applies the same data model as a *companion document* (our specs are
ReSpec/Markdown and stay untouched), extended with the certification testability spine and
per-statement test-gap honesty.

Full rationale, the primary-source survey, and the rollout map:
[`docs/DESIGN.md`](./docs/DESIGN.md).

## Layout

| Path | What |
|---|---|
| `vocab/spec-companion.ttl` | The minimal minted vocabulary (`https://w3id.org/jeswr/spec-companion#` — 11 terms + the 4 spine levels; everything else reuses `spec:`/`td:`/`earl:`/`dcterms:`/`prov:`) |
| `shapes/spec-companion.shape.ttl` | The SHACL guardrail: provenance + coverage declarations + per-statement completeness + "no Enforceable MUST without a test or an honest gap" + "no P without justification" |
| `tools/validate.mjs` | The validator: Turtle parse → SHACL (shacl-engine) → global checks (unique ids, anchors under the spec base, RFC 2119 keyword/level consistency, verbatim-quote fidelity against the spec's HTML source) |
| `examples/dpop-sk/` | **Worked example**: the full DPoP-SK companion — 73 normative statements, validating with zero errors and zero warnings against the pinned spec source (`index.html` vendored at `f485855`) |
| `examples/negative/` | The guardrail's teeth: a minimal valid template plus five deliberately broken companions the gate must reject |

## Usage

```bash
cd tools && npm ci
npm test                            # worked example validates; broken fixtures rejected

# validate one companion (quote fidelity needs the spec's HTML source):
node validate.mjs ../examples/dpop-sk/spec.statements.ttl \
  --spec-html ../examples/dpop-sk/index.html
```

In a spec repo (the rollout shape), the companion lives beside the spec and the repo's
gate runs the validator with `--spec-html index.html`, so a spec edit that touches a
quoted sentence fails until the companion is re-extracted in the same commit.

## Status

Phase 1 (investigation + design + the dpop-sk worked example) is complete and the
per-spec rollout is **complete**: companions live beside their specs in
`dpop-sk-spec`, `a2a-rdf-extension`, `solid-webauthn-reauth-spec`, `lws-spec`
(core + rdf-transform), `solid-sparql-query` and `agent-authz-credential-spec`.
The `agentic-solid-note` is wholly informative and gets no requirement companion
by design.

## Provenance

Designed and built by Claude Fable 5 (AI-assisted; maintainer-review policy applies),
2026-07-06, from primary sources cited in `docs/DESIGN.md`. License: MIT.

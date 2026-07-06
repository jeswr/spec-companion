<!-- AUTHORED-BY Claude Fable 5 -->

# Machine-readable spec companions — investigation, design, and worked example

**Status:** Phase-1 deliverable (investigation + design + one validating worked example),
per the maintainer directive of 2026-07-06. The per-spec rollout fans out afterwards.
**Verdict up front: YES — a good approach exists**, and most of it does not need inventing:
the Solid ecosystem already publishes normative statements as RDF (the Solid Protocol's
RDFa requirement markup over `http://www.w3.org/ns/spec#`), and the missing pieces — the
testability spine, honest test-gap accounting, and a strict authoring guardrail — come
from this suite's own prior art (the certification E/A-int/A-exist/P spine,
`agentic-solid-conformance`'s clause-pinned vectors and `GAPS.md`) plus a SHACL
"spec-of-specs" shape.

The companions are **complementary sidecar documents**. The full-text specs are the
normative documents and are **kept unchanged** — a companion never replaces, restates
normatively, or overrides its spec.

---

## 1. Investigation — the real options, primary-source-verified

### 1.1 Normative keywords and their machine-readability

- **RFC 2119 / RFC 8174** (<https://www.rfc-editor.org/rfc/rfc2119>,
  <https://www.rfc-editor.org/rfc/rfc8174>) define the keyword families; RFC 8174
  restricts normative force to the UPPERCASE forms. Everything below builds on them, and
  the extraction rules in §4 mechanize the RFC 8174 discipline (lowercase "may/should"
  is flagged, not silently promoted).
- **IETF canonical XML marks keywords as data.** The xml2rfc v3 vocabulary (RFC 7991,
  §2.9, <https://www.rfc-editor.org/rfc/rfc7991.html>) defines a `<bcp14>` element that
  wraps exactly the BCP 14 phrase — so in modern RFC XML the keywords ARE extractable
  markup. Precedent that "keywords as data" is standard practice, not exotic.
- **ReSpec / Bikeshed** mark definitions (`<dfn>`, `data-export`) and cross-spec citations
  (`data-cite`) and generate the RFC 2119 conformance boilerplate
  (<https://respec.org/docs/>), but neither emits per-statement requirement objects.
  **w3c/webref / Reffy** (<https://github.com/w3c/webref>) machine-extract dfns, IDL, CSS,
  headings and links from hundreds of specs — but explicitly **not normative statements
  as such**. So "extract requirements from rendered HTML" has no off-the-shelf tool;
  statement extraction remains an authored act (which is fine — see §5).
- **SpecRef** (<https://www.specref.org/>) is the community bibliographic database with a
  public JSON API — the right way for companions to cite other specs by reference id
  (used by ReSpec/Bikeshed already); nothing to mint here.

### 1.2 Requirements-as-data vocabularies (the core question)

- **`http://www.w3.org/ns/spec#` — the winner, and already ours-adjacent.** Verified live
  (2026-07-06; Turtle at <https://www.w3.org/ns/spec>, maintained in
  <https://github.com/solid/vocab>, author Sarven Capadisli, status "testing"/WIP,
  CC0): it defines `spec:Requirement`, `spec:statement`, `spec:requirementSubject`,
  `spec:requirementLevel` with a SKOS scheme of exactly the RFC 2119/8174 levels
  (`spec:MUST`, `spec:MUSTNOT`, `spec:SHOULD`, `spec:SHOULDNOT`, `spec:MAY`, plus the
  RFC 8174 synonyms with declared equivalences), `spec:Advisement` + advisement levels,
  `spec:testCase`/`spec:testScript`/`spec:requirementReference` (wired to the
  test-description vocabulary), `spec:Specification`, `spec:SecurityConsiderations`,
  conformance-profile machinery and changelogs.
- **The Solid Protocol already uses it, inline.** Verified against the spec source
  (`solid/specification` `protocol.html`): **94 `spec:requirement`s and 38
  `spec:advisement`s** are RDFa-embedded, each an anchored IRI, e.g.:

  ```html
  <span about="" id="server-http" rel="spec:requirement" resource="#server-http">
    <span property="spec:statement">
      <span rel="spec:requirementSubject" resource="#Server">Servers</span>
      <span rel="spec:requirementLevel" resource="spec:MUST">MUST</span>
      conform to <cite>HTTP Semantics</cite> [RFC9110].</span></span>
  ```

- **The Solid conformance test harness consumes exactly this.** Verified against
  `solid-contrib/specification-tests` (`protocol/solid-protocol-test-manifest.ttl`):
  test cases are `td:TestCase` with `spec:requirementReference sopr:server-…` +
  `spec:testScript` (Karate/Gherkin `.feature`) + `td:reviewStatus`. PSS runs this
  harness today. **So requirement-annotated specs + requirement-referencing tests are the
  established Solid-ecosystem pattern**; the @jeswr specs (ReSpec/Markdown, kept
  unchanged) just need the same data as a *sidecar graph* instead of inline RDFa.
- **EARL 1.0** (W3C Note, 2017-02-02, <https://www.w3.org/TR/EARL10-Schema/>,
  ns `http://www.w3.org/ns/earl#`): `earl:TestCriterion` ⊃ {`earl:TestRequirement`,
  `earl:TestCase`}, and `earl:Assertion` {assertedBy, subject, test, result, mode}.
  EARL is the **results** layer — when an implementation runs a conformance suite, its
  report should be EARL assertions whose `earl:test` is the statement/vector IRI (the
  suite already produces EARL from the CTH, and `@jeswr/solid-a11y-report` models EARL).
  Reused as-is; nothing minted.
- **ACT Rules Format 1.1** (**W3C Recommendation, 2026-02-05**,
  <https://www.w3.org/TR/act-rules-format-1.1/>): the strongest prior art for *rule ↔
  requirement mapping discipline* — every rule MUST carry an accessibility-requirements
  mapping (requirement id + document + conformance designation + what each outcome means)
  and MUST ship examples for each outcome. Its lessons are adopted structurally: mandatory
  statement↔test mapping (or an honest gap), and outcome semantics live in the vector
  format (`agentic-solid-conformance` `expected`), not in prose.
- **W3C SpecGL — QA Framework: Specification Guidelines** (W3C Recommendation,
  2005-08-17, <https://www.w3.org/TR/qaframe-spec/>): the canonical *authoring guardrail*
  checklist — include a conformance clause (Req 1), identify classes of products (Req 3),
  use RFC 2119 keywords consistently (Req 7), mark what is mandatory vs optional (Req 8),
  write test assertions (GP 12). **The SHACL shape in §4 is a mechanized subset of
  SpecGL** — that is its design brief.
- **ReqIF** (OMG, v1.2, 2016, <https://www.omg.org/spec/ReqIF/>): the
  requirements-management industry's requirements-as-data interchange format (XML/XSD,
  typed requirement objects + attributes). Confirms the requirements-as-data idea is
  industrially mature, but it is tooling-ecosystem XML, not linked data — not adopted.

### 1.3 Behavioural and formal options

- **Gherkin / given-when-then**: already present in the ecosystem — the CTH's
  `spec:testScript`s are `.feature` files. For OUR specs the language-neutral,
  executable-verdict form is the `agentic-solid-conformance` **data vectors** (JSON cases
  + RDF fixtures, verdicts extracted by executing pinned reference implementations); a
  Gherkin layer would add an English DSL without adding machine verdicts. Not adopted;
  the companion links statements to vector cases instead.
- **Lightweight formal methods (TLA+ / Alloy)** for the protocol/state-machine security
  cores (dpop-sk's establishment + sliding-window; webauthn-reauth's token exchange):
  **warranted eventually, not phase 1**. Exactly the properties that are `A-exist` under
  black-box testing (the atomicity of verify-then-mark under concurrency — see
  `DPOPSK-AR-9`) are the ones a model checker pins cheaply. The companion format carries
  an `sc:formalModel` link property as the seam; a TLA+ model of the DPoP-SK
  session/window state machine is a recommended follow-up, not a blocker.
- **SHACL/ShEx for data-shape specs**: already the suite's practice (SHACL protocol docs
  in `solid-a2a`, shape packages, `<jeswr-shacl-view>`); data-shape specs keep publishing
  their shapes as the machine-readable artifact — the companion adds the *statement*
  layer on top and can point `spec:testCase` at shape-validation vectors
  (`validate-intent` in the a2a-rdf suite already does this).

### 1.4 Our own prior art (reused, not re-derived)

- **The certification testability spine** (`jeswr/solid-certification`
  `v2-speculative/README.md`): E (enforceable, black-box) / A-int (integrity-verifiable
  trail) / A-exist (presence/audit only, never certified as a guarantee) / P (premature).
  Ported here as four `sc:TestabilityLevel` individuals with definitions recast for
  protocol statements (§3). Its core warning — *never dress an A-exist claim as E* —
  becomes machine-visible: every statement carries the tag, and the E+MUST class is the
  one the coverage guardrail forces tests-or-gaps for.
- **`agentic-solid-conformance`**: vectors already pin normative clauses
  (`case.json.clauses`, manifest `clauseIndex`) and `GAPS.md` catalogues the un-vectorable
  statements with reasons. The companion strengthens both ends: statements get **stable
  ids** (so vectors can pin `DPOPSK-AR-8` instead of the brittle `"§5.1"` strings), and
  the GAPS discipline becomes per-statement `sc:testGap` nodes a shape can enforce.

---

## 2. Recommendation — the companion format

**One Turtle file per spec, `spec.statements.ttl`, published beside the spec.** The data
model (all reused terms unless prefixed `sc:`):

| Piece | Term(s) | Notes |
|---|---|---|
| The companion itself | `sc:CompanionDocument` + `sc:companionOf` + `sc:specVersion` (git sha pin) + `dcterms:created` + `prov:wasAttributedTo` + `sc:extractionNote…` | Provenance + staleness pin + surfaced ambiguities |
| The spec | `spec:Specification` + `dcterms:title` + `spec:conformance` (anchor) + `spec:consideration` (incl. a node typed `spec:SecurityConsiderations`) + `spec:requirement …` | The SpecGL coverage declarations |
| Conformance classes | `sc:ConformanceClass` + `rdfs:label` + `sc:definedBy` (anchor) | Closed actor set |
| A normative statement | `spec:Requirement` with: `dcterms:identifier` (stable id, `DPOPSK-AR-8` style) · `spec:statement` (**verbatim quote**, validator-checked against the spec source) · `spec:requirementLevel` (canonical five only) · `spec:requirementSubject` (≥1 declared class) · `sc:testability` (E / A-int / A-exist / P) · `sc:anchor` (resolvable fragment under the spec base) · `spec:testCase` (vector case URL) and/or `sc:testGap` · optional `rdfs:comment` (context for sentence fragments), `sc:restates` (dedup link), `sc:formalModel` | One statement = one level; multi-level sentences are split |
| Test gaps | `sc:TestGap` + `dcterms:description` (≥30 chars) | The per-statement GAPS.md |

Namespace minted: `https://w3id.org/jeswr/spec-companion#` (**11 terms + 4 individuals**;
everything else is `spec:`/`td:`/`earl:`/`dcterms:`/`prov:`/`skos:`/`rdfs:`). The
canonical home of the vocabulary is this repo
(`https://github.com/jeswr/spec-companion`); namespace resolution is served from
jeswr.org (built separately — no w3id PR is planned). Nothing depends on the namespace
IRI resolving: all consumers get the vocab file from the repo.

**Why verbatim quotes rather than paraphrase**: a paraphrase is a second normative text —
exactly the ambiguity this format exists to remove. The quote + anchor makes the
companion *derivative by construction*, and the validator's quote-fidelity check (G4)
makes drift mechanically impossible: change the spec sentence and the companion fails
until re-extracted.

**Why RDF/Turtle rather than JSON/YAML**: the statements need to be *referenced* — by
conformance vectors, by EARL reports, by the standards-interop-map's requirement graph,
by certification requirement tables. IRIs + the already-deployed `spec:` vocabulary give
that for free, match the suite's Linked-Data conventions, and mean a Solid Protocol
requirement and a DPoP-SK requirement are the *same kind of node* in one queryable graph.

## 3. The testability spine, recast for spec statements

| Tag | Individual | Meaning for a statement | dpop-sk example |
|---|---|---|---|
| E | `sc:Enforceable` | Deterministic black-box vector can pin it | `DPOPSK-AR-5` (reject zero/non-numeric counters) |
| A-int | `sc:AccountableIntegrity` | An artifact the implementation produces re-verifies independently | (none in dpop-sk — it is a request/response profile; the VC/ODRL/a2a-rdf specs are where A-int lives, e.g. RDFC-1.0 hash pins) |
| A-exist | `sc:AccountableExistence` | Audit/inspection only: negative internals (never log K), timing (constant-time), concurrency atomicity, deployment topology | `DPOPSK-SEC-KH-1`, `DPOPSK-AR-9`, `DPOPSK-DISC-3` |
| P | `sc:Premature` | Not testable as specified — must carry a justification | `DPOPSK-AR-4` (2^64 counter exhaustion) |

The certification scheme's use (certify E and A-int, disclose A-exist, decline P)
composes directly: a certifier can SELECT the E+A-int statements of a spec from its
companion graph.

## 4. The strict authoring guardrail

Two enforced layers, shipped together (`shapes/spec-companion.shape.ttl` +
`tools/validate.mjs`); a companion is well-formed only when **both** pass:

**SHACL (structural, portable):** every companion pins spec + version + provenance +
date; the spec declares conformance-clause and security-considerations coverage and ≥1
requirement + ≥1 conformance class (SpecGL Reqs 1/3 mechanized); every statement has
exactly one stable id (pattern-checked), one verbatim quote (min length), one canonical
level (`sh:in` the five), ≥1 subject each `sh:class sc:ConformanceClass`, exactly one
testability tag, exactly one fragment-bearing anchor; **no orphan statements** (an
inverse-path constraint ties every statement back to exactly one `spec:Specification`
via `spec:requirement`); **the coverage guardrail** (an
E-tagged MUST/MUST NOT must link `spec:testCase` or `sc:testGap` — never neither) and
**the P-honesty guardrail** (P always justified) as `sh:or` node shapes; test gaps need
real descriptions (≥30 chars).

**Validator globals (what core SHACL can't say portably):**
- **G1** stable ids unique across the file;
- **G2** every anchor/definedBy IRI has a non-empty fragment and its
  URL-normalized document part (WHATWG URL parse — dot segments resolved, so
  `…/spec/../spec-evil#x` cannot escape a directory base) is the spec base document
  itself or, for a directory-style base ending in `/`, a document under it —
  boundary-safe, so a sibling IRI that merely string-prefixes the base
  (`…/spec-evil` vs base `…/spec`) is rejected;
- **G3** RFC 2119 keyword/level consistency — the quote contains its own level's keyword
  family (RFC 8174 synonyms accepted; negated families tokenized first so "MUST NOT"
  never satisfies MUST); foreign-family keywords in one quote are split-candidate
  warnings;
- **G4** quote fidelity — with `--spec-html`, every `spec:statement` must be a verbatim
  substring of the normalized spec source (tags stripped, entities decoded, `[[refs]]`
  unbracketed, whitespace collapsed);
- **G5** every statement is referenced exactly once via `spec:requirement` from THE
  `sc:companionOf` spec node — a decoy second `spec:Specification` claiming a statement
  cannot satisfy the linkage (complements the SHACL inverse-path constraint).

Deliberate split rationale: SHACL-SPARQL could express G1–G3 but the suite's JS engines
(`shacl-engine`, `rdf-validate-shacl`) don't implement it uniformly; core-SHACL + a
40-line deterministic checker is more portable and easier to audit than SPARQL-in-shapes.

**Engine finding (worth upstreaming):** `shacl-engine@1.1.2` silently keeps only one
`sh:or` when a single node shape carries two `sh:or` constraints (empirically verified;
SHACL requires both to apply). The shapes therefore put each `sh:or` rule in its own
targeted node shape, with a comment. Filing a minimal repro upstream
(`zazuko/shacl-engine`) is a follow-up.

## 5. Generation and validation pipeline

- **Extraction is authored, not scraped** (webref confirms no extractor for normative
  statements exists). An agent/human extracts statements section-by-section; the
  validator's G3/G4 make wrong levels and non-verbatim quotes impossible to land, and the
  SHACL shape makes missing fields impossible. This inverts the usual risk: the *format*
  is unambiguous and the *checks* are mechanical, so extraction mistakes are caught, not
  trusted.
- **Same-commit maintenance rule** (mirrors the skills rule in the PSS charter): a change
  to a spec's normative text and its companion land in the SAME commit; the companion's
  `sc:specVersion` pin plus a repo gate (`node tools/validate.mjs spec.statements.ttl
  --spec-html index.html` wired into the spec repo's test script) makes a stale companion
  a red gate, not a doc-drift.
- **Extraction surfaces spec bugs** — by design. Extracting dpop-sk produced six
  `sc:extractionNote`s (recorded in the companion itself): keyword-less normative
  verification steps, a definitional KDF with no BCP 14 hook, non-BCP14 "REQUIRES",
  a normative lowercase "may", a two-level sentence, and the keyword-less conformance
  enumeration. Each is an errata candidate for the spec editor. This is the
  "less-ambiguous" payoff: ambiguity becomes a tracked artifact.

## 6. Where companions live — decision

**The companion data lives in each spec's own repo** (`spec.statements.ttl` beside
`index.html`, published by the same GitHub Pages deploy, validated by that repo's gate).
**The vocabulary + shapes + validator live here** (`jeswr/spec-companion`), consumed by
spec repos as a dev-dependency (`github:jeswr/spec-companion#<sha>`) or a vendored copy.

Rationale: (a) same-commit atomicity between spec and companion is only enforceable when
they share a repo and a gate — a central data repo reintroduces exactly the cross-repo
drift this design eliminates; (b) the shape/validator is one artifact with one
maintenance home and one upstream (this repo), like every other suite library; (c) a
central *catalog* (VoID/DCAT dataset listing every companion URL, queryable cross-spec)
is still easy later — it aggregates by reference, not by copy — and is a natural phase-2
here. The `examples/dpop-sk/` copy in this repo is the worked example and template; on
rollout it MOVES to `jeswr/dpop-sk-spec` (with its `index.html` pin dropped in favour of
the sibling file).

Discovery nicety (rollout, per-spec): a `<link rel="alternate"
type="text/turtle" href="spec.statements.ttl">` in the spec's `<head>` — additive, but it
does touch the spec HTML, so it is called out for maintainer steer rather than assumed by
this design (the directive keeps full texts unchanged).

## 7. Rollout map (after this phase; one bead per spec)

| Spec | Companion notes |
|---|---|
| `dpop-sk-spec` | **Done here** (73 statements, validating); move `examples/dpop-sk/spec.statements.ttl` into the repo + wire the gate |
| `a2a-rdf-extension` | Statements link straight to the existing `vectors/a2a-rdf/*` cases (`spec:testCase`); several A-int statements (RDFC-1.0 hash pinning) |
| `solid-webauthn-reauth-spec` | Protocol/state-machine spec; candidate for the first `sc:formalModel` link |
| `agent-authz-credential-spec` | Links to the 29 `agent-authz-credential` vectors |
| `lws-spec` | Largest; its companion doubles as the LWS test-suite requirement index (the W3C-test-suite goal in the LWS initiative) |
| `agentic-solid-note` | **Wholly informative (noRecTrack)** — no `spec:Requirement`s exist; either no companion, or an advisement-only variant (`spec:advisement`); do not force the shape onto it |
| `agentic-solid-conformance` | Not a spec: instead migrate `case.json.clauses` from `"§5.1"` strings to statement ids as companions land (additive field, keep both during transition) |
| AC-SPARQL / s43 + other sparq-agent specs | Same format applies; PSS does not own the working tree — file a `jeswr/sparq` issue offering the format + this repo's validator, signed as the PSS agent |

## 8. standards-interop-map alignment — status

Read locally 2026-07-06: the repo exists but is pre-first-commit (branch
`feat/phase1-map`, one harvest script + `data/groups.ttl`). It mints
`https://w3id.org/jeswr/interop#` and already reuses `org:`/`dcterms:`/`prov:`/`void:` —
compatible conventions, **but its use-case/requirement ontology does not exist yet**, so
there is nothing to align against today. Compatibility is designed in from this side:
statements are plain `spec:Requirement` IRIs with standard metadata, so an interop-map
requirement node can `dcterms:references`/`owl:sameAs`-bridge or subclass them without
this format changing. **Follow-up (flagged, not resolved):** when the interop-map's
requirement model lands, reconcile — preferred outcome is the interop map adopting
`spec:Requirement` + the level SKOS scheme for spec-derived requirements so both graphs
join natively; coordinate via that repo's issue tracker once it is published.

## 9. Follow-ups (for the tracker, not markdown TODOs — enumerated here as the phase-1 report)

1. Per-spec rollout beads (§7), one at a time, each gated by this validator.
2. Namespace resolution for `https://w3id.org/jeswr/spec-companion#` served from
   jeswr.org (being built separately; no w3id PR — maintainer directive). Until then the
   canonical home is https://github.com/jeswr/spec-companion.
3. Upstream minimal repro of the shacl-engine double-`sh:or` limitation.
4. dpop-sk errata candidates from the six extraction notes (issue on `jeswr/dpop-sk-spec`).
5. `agentic-solid-conformance` clause→statement-id migration (additive).
6. Phase-2 central catalog (VoID/DCAT list of companion URLs) + optional
   `<link rel="alternate">` discovery (maintainer steer).
7. TLA+ model of the DPoP-SK session/window state machine (`sc:formalModel` seam).
8. Interop-map requirement-ontology reconciliation (§8).
9. The `spec:` vocabulary is status "testing" (WIP): consumers depend only on term IRIs
   (no fetch at validation time); if upstream terms move, the vendored term list in
   `vocab/` and shapes update together — watch `solid/vocab`.

## 10. Security & privacy posture

The validator is fully offline: it reads only local files named on its command line — no
network fetches, no credentials, no remote SHACL imports (`owl:imports` is never
dereferenced). Companion files contain only published-spec content and public IRIs.
Nothing here touches user data, tokens, or third-party origins.

#!/usr/bin/env node
// AUTHORED-BY Claude Fable 5
//
// PHASE-2 CATALOG (jeswr/spec-companion DESIGN §6 + §9 follow-up 6): a DCAT/VoID
// index of every landed spec-companion across the @jeswr repos, aggregated BY
// REFERENCE (each entry points at the companion's published URL — it never copies
// companion content, so the companion in its own repo stays the single source of
// truth and this catalog cannot drift into a second copy).
//
// The catalog is GENERATED from the committed companions:
//   node catalog.mjs            → (re)write catalog/companions.ttl + companions.md
//   node catalog.mjs --check    → validate the COMMITTED catalog/companions.ttl
//                                 (self-contained: needs no sibling repos; runs in
//                                 the base gate)
//
// Companions live in each spec's own repo, checked out beside this one; the scan
// root defaults to the parent of spec-companion, override with $SPEC_COMPANION_ROOT.
// RDF is parsed and SERIALISED with n3 (house rule: n3.Writer, never hand-built
// triples).

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import N3 from "n3";

const { DataFactory, Parser, Writer } = N3;
const { namedNode, literal, blankNode, quad } = DataFactory;

const HERE = dirname(fileURLToPath(import.meta.url));
const CATALOG_DIR = resolve(HERE, "..", "catalog");
const TTL_PATH = join(CATALOG_DIR, "companions.ttl");
const MD_PATH = join(CATALOG_DIR, "companions.md");

const NS = {
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  dcat: "http://www.w3.org/ns/dcat#",
  dcterms: "http://purl.org/dc/terms/",
  void: "http://rdfs.org/ns/void#",
  prov: "http://www.w3.org/ns/prov#",
  foaf: "http://xmlns.com/foaf/0.1/",
  sc: "https://w3id.org/jeswr/spec-companion#",
  spec: "http://www.w3.org/ns/spec#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
};
const T = (curie) => {
  const [p, l] = curie.split(":");
  return namedNode(NS[p] + l);
};
const RDF_TYPE = T("rdf:type");

// Logical identity of the catalog + its datasets: the file's canonical raw URL
// (matches how the suite pins companion doc IRIs; not a minted vocab term).
const CATALOG_IRI =
  "https://raw.githubusercontent.com/jeswr/spec-companion/main/catalog/companions.ttl";

/** Discover companion files: <root>/<repo>/*.statements.ttl (excluding this repo). */
function discover(root) {
  const out = [];
  for (const entry of readdirSync(root).sort()) {
    if (entry === "spec-companion" || entry.startsWith(".") || entry === "node_modules") continue;
    const repoDir = join(root, entry);
    let st;
    try {
      st = statSync(repoDir);
    } catch {
      continue;
    }
    if (!st.isDirectory()) continue;
    let files;
    try {
      files = readdirSync(repoDir);
    } catch {
      continue;
    }
    for (const f of files.sort()) {
      if (f.endsWith(".statements.ttl")) out.push({ repo: entry, file: join(repoDir, f), basename: f });
    }
  }
  return out;
}

/** Parse a companion and pull the catalog-relevant metadata + headline counts. */
function readCompanion({ repo, file, basename }) {
  const quads = new Parser().parse(readFileSync(file, "utf8"));
  let doc = null;
  let companionOf = null;
  let specVersion = null;
  let title = null;
  let created = null;
  const reqs = new Set();
  const withTest = new Set();
  const withGap = new Set();
  const mustish = new Set();
  const titleBySubject = new Map();
  const createdBySubject = new Map();

  for (const q of quads) {
    const s = q.subject.value;
    const p = q.predicate.value;
    const o = q.object.value;
    if (p === NS.rdf + "type" && o === NS.sc + "CompanionDocument") doc = s;
    if (p === NS.rdf + "type" && o === NS.spec + "Requirement") reqs.add(s);
    if (p === NS.sc + "companionOf") companionOf = o;
    if (p === NS.sc + "specVersion") specVersion = o;
    if (p === NS.dcterms + "title") titleBySubject.set(s, o);
    if (p === NS.dcterms + "created") createdBySubject.set(s, o);
    if (p === NS.spec + "testCase") withTest.add(s);
    if (p === NS.sc + "testGap") withGap.add(s);
    if (p === NS.spec + "requirementLevel" && (o === NS.spec + "MUST" || o === NS.spec + "MUSTNOT"))
      mustish.add(s);
  }
  if (!doc) throw new Error(`${file}: no sc:CompanionDocument (not a companion?)`);
  title = titleBySubject.get(doc) ?? null;
  created = createdBySubject.get(doc) ?? null;

  // Stable dataset slug: repo dir, disambiguated by companion basename when a repo
  // ships more than one companion (e.g. lws-spec index/rdf-transform).
  const stem = basename.replace(/\.statements\.ttl$/, "");
  return {
    repo,
    stem,
    doc,
    companionOf,
    specVersion,
    title,
    created,
    statements: reqs.size,
    must: mustish.size,
    covered: withTest.size,
    gaps: withGap.size,
    sourceRepo: `https://github.com/jeswr/${repo}`,
  };
}

function build(root) {
  const found = discover(root);
  if (found.length === 0) throw new Error(`no companions found under ${root}`);
  const entries = found
    .map(readCompanion)
    .sort((a, b) => (a.repo + a.stem).localeCompare(b.repo + b.stem));

  // slug per entry: repo, or repo-stem when the repo has multiple companions.
  const repoCounts = {};
  for (const e of entries) repoCounts[e.repo] = (repoCounts[e.repo] ?? 0) + 1;
  for (const e of entries) e.slug = repoCounts[e.repo] > 1 ? `${e.repo}-${e.stem}` : e.repo;

  return entries;
}

function writeTurtle(entries, modified) {
  const catalog = namedNode(CATALOG_IRI);
  const ds = (e) => namedNode(`${CATALOG_IRI}#${e.slug}`);
  const quads = [];

  quads.push(
    quad(catalog, RDF_TYPE, T("dcat:Catalog")),
    quad(catalog, T("dcterms:title"), literal("@jeswr spec-companion catalog", "en")),
    quad(
      catalog,
      T("dcterms:description"),
      literal(
        "A DCAT index of the machine-readable normative-statement companions for the @jeswr specification family. Each dataset points (by reference) at a companion's published Turtle graph; the companions themselves live in their specs' own repositories and remain the single source of truth. Generated by tools/catalog.mjs.",
        "en",
      ),
    ),
    quad(catalog, T("dcterms:publisher"), namedNode("https://jeswr.org/#me")),
    quad(catalog, T("dcterms:license"), namedNode("https://opensource.org/licenses/MIT")),
    quad(catalog, T("dcterms:modified"), literal(modified, T("xsd:date"))),
    quad(catalog, T("foaf:homepage"), namedNode("https://github.com/jeswr/spec-companion")),
  );
  for (const e of entries) quads.push(quad(catalog, T("dcat:dataset"), ds(e)));

  for (const e of entries) {
    const node = ds(e);
    quads.push(quad(node, RDF_TYPE, T("dcat:Dataset")));
    if (e.title) quads.push(quad(node, T("dcterms:title"), literal(e.title, "en")));
    quads.push(quad(node, T("dcterms:conformsTo"), T("sc:")));
    if (e.companionOf) {
      quads.push(quad(node, T("sc:companionOf"), namedNode(e.companionOf)));
      quads.push(quad(node, T("dcat:landingPage"), namedNode(e.companionOf)));
    }
    if (e.specVersion) quads.push(quad(node, T("sc:specVersion"), literal(e.specVersion)));
    if (e.created) quads.push(quad(node, T("dcterms:created"), literal(e.created, T("xsd:date"))));
    quads.push(quad(node, T("prov:wasDerivedFrom"), namedNode(e.sourceRepo)));
    quads.push(
      quad(node, T("void:entities"), literal(String(e.statements), T("xsd:nonNegativeInteger"))),
    );
    const dist = blankNode();
    quads.push(
      quad(node, T("dcat:distribution"), dist),
      quad(dist, RDF_TYPE, T("dcat:Distribution")),
      quad(dist, T("dcat:downloadURL"), namedNode(e.doc)),
      quad(dist, T("dcat:mediaType"), literal("text/turtle")),
    );
  }

  const writerPrefixes = {};
  for (const p of ["rdf", "dcat", "dcterms", "void", "prov", "foaf", "sc", "xsd"])
    writerPrefixes[p] = NS[p];
  const writer = new Writer({ prefixes: writerPrefixes });
  writer.addQuads(quads);
  let ttl;
  writer.end((err, result) => {
    if (err) throw err;
    ttl = result;
  });
  const header =
    "# AUTHORED-BY Claude Fable 5\n" +
    "# GENERATED by tools/catalog.mjs — do not edit by hand; run `npm run catalog`.\n" +
    "# Phase-2 catalog: a by-reference DCAT index of every landed @jeswr spec-companion.\n\n";
  writeFileSync(TTL_PATH, header + ttl.trimEnd() + "\n", "utf8");
}

function writeMarkdown(entries, modified) {
  const totals = entries.reduce(
    (a, e) => ({
      statements: a.statements + e.statements,
      must: a.must + e.must,
      covered: a.covered + e.covered,
      gaps: a.gaps + e.gaps,
    }),
    { statements: 0, must: 0, covered: 0, gaps: 0 },
  );
  const rows = entries
    .map((e) => {
      const spec = e.companionOf ? `[spec](${e.companionOf})` : "—";
      const comp = `[\`${e.stem}.statements.ttl\`](${e.doc})`;
      const src = `[\`jeswr/${e.repo}\`](${e.sourceRepo})`;
      return `| ${e.title ?? e.slug} | ${src} | ${spec} · ${comp} | \`${(e.specVersion ?? "").slice(0, 7)}\` | ${e.statements} | ${e.must} | ${e.covered} | ${e.gaps} |`;
    })
    .join("\n");
  const md = `<!-- AUTHORED-BY Claude Fable 5 -->
<!-- GENERATED by tools/catalog.mjs — do not edit by hand; run \`npm run catalog\`. -->

# spec-companion catalog

The machine-readable normative-statement companions for the @jeswr specification
family. The queryable data form is [\`companions.ttl\`](./companions.ttl) (DCAT/VoID);
this table is its human-readable rendering. Both are generated from the committed
companions in their specs' own repositories — see [\`README.md\`](./README.md).

**${entries.length} companions across ${new Set(entries.map((e) => e.repo)).size} repositories · ${totals.statements} normative statements** (last generated ${modified}).

| Companion | Repo | Spec · companion | Spec version | Statements | MUST/MUST&nbsp;NOT | Test&#8209;covered | Test gaps |
|---|---|---|---:|---:|---:|---:|---:|
${rows}
| **Total** | | | | **${totals.statements}** | **${totals.must}** | **${totals.covered}** | **${totals.gaps}** |

**Columns.** *Statements* = normative statements (\`spec:Requirement\`) in the companion.
*MUST/MUST NOT* = of those, the mandatory ones. *Test-covered* = statements linked to a
conformance vector (\`spec:testCase\`). *Test gaps* = statements with an honest recorded
no-vector justification (\`sc:testGap\`). Per-statement detail (verbatim quote, level,
testability tag, anchor, the actual test/gap) lives in each companion — this catalog
aggregates by reference, never by copy.
`;
  writeFileSync(MD_PATH, md, "utf8");
}

// ---- check mode: validate the committed catalog, no siblings required ----------
function check() {
  const quads = new Parser().parse(readFileSync(TTL_PATH, "utf8"));
  const type = new Map(); // subject -> Set(types)
  const has = (s, p) => quads.some((q) => q.subject.value === s && q.predicate.value === p);
  const objOf = (s, p) =>
    quads.filter((q) => q.subject.value === s && q.predicate.value === p).map((q) => q.object);
  for (const q of quads) {
    if (q.predicate.value === NS.rdf + "type") {
      if (!type.has(q.subject.value)) type.set(q.subject.value, new Set());
      type.get(q.subject.value).add(q.object.value);
    }
  }
  const problems = [];
  const catalogs = [...type].filter(([, t]) => t.has(NS.dcat + "Catalog")).map(([s]) => s);
  if (catalogs.length !== 1) problems.push(`expected exactly 1 dcat:Catalog, found ${catalogs.length}`);
  const datasets = objOf(catalogs[0] ?? "", NS.dcat + "dataset").map((o) => o.value);
  if (datasets.length === 0) problems.push("catalog lists no dcat:dataset");
  for (const d of datasets) {
    if (!type.get(d)?.has(NS.dcat + "Dataset")) problems.push(`${d}: not a dcat:Dataset`);
    if (!has(d, NS.dcterms + "title")) problems.push(`${d}: missing dcterms:title`);
    if (!has(d, NS.sc + "specVersion")) problems.push(`${d}: missing sc:specVersion`);
    if (!has(d, NS.sc + "companionOf")) problems.push(`${d}: missing sc:companionOf`);
    const dist = objOf(d, NS.dcat + "distribution");
    if (dist.length === 0) problems.push(`${d}: no dcat:distribution`);
    for (const dd of dist) {
      if (!has(dd.value, NS.dcat + "downloadURL")) problems.push(`${d}: distribution has no downloadURL`);
    }
  }
  if (problems.length > 0) {
    console.error(`catalog: ${problems.length} problem(s):`);
    for (const p of problems) console.error(`  FAIL ${p}`);
    process.exit(1);
  }
  console.log(`catalog: OK (${datasets.length} companions listed, well-formed DCAT)`);
}

// ---- main ----------------------------------------------------------------------
if (process.argv.includes("--check")) {
  check();
} else {
  const root = process.env.SPEC_COMPANION_ROOT
    ? resolve(process.env.SPEC_COMPANION_ROOT)
    : resolve(HERE, "..", "..");
  const modified = new Date().toISOString().slice(0, 10);
  const entries = build(root);
  writeTurtle(entries, modified);
  writeMarkdown(entries, modified);
  console.log(
    `catalog: wrote ${entries.length} companions (${new Set(entries.map((e) => e.repo)).size} repos) from ${root}`,
  );
}

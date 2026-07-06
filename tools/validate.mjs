#!/usr/bin/env node
// AUTHORED-BY Claude Fable 5
//
// spec-companion validator — the executable half of the "spec-of-specs" guardrail.
//
//   node validate.mjs <companion.ttl> [--shapes <shape.ttl>] [--vocab <vocab.ttl>]
//                     [--spec-html <index.html>] [--quiet]
//
// Runs, in order:
//   1. Turtle parse (n3) of the companion (+ vocab, merged into the data graph so
//      sh:class checks over sc:TestabilityLevel individuals resolve).
//   2. SHACL validation (shacl-engine) against the spec-of-specs shapes.
//   3. The global checks core SHACL cannot express portably:
//        G1  duplicate stable ids (dcterms:identifier unique across statements)
//        G2  every sc:anchor and sc:definedBy IRI is under the sc:companionOf spec base
//        G3  RFC 2119 keyword/level consistency: the verbatim statement text contains
//            its own level's keyword family (RFC 8174 synonyms accepted), with
//            negated forms tokenized first so "MUST NOT" never satisfies MUST;
//            foreign-family keywords in the same quote are WARNINGS (split candidates)
//        G4  quote fidelity (only with --spec-html): every spec:statement is a
//            verbatim substring of the normalized spec source (tags stripped,
//            entities decoded, [[refs]] unbracketed, whitespace collapsed)
//        G5  every statement is referenced exactly once via spec:requirement from
//            THE sc:companionOf spec node (a decoy second spec:Specification cannot
//            satisfy the linkage)
//
// Exit codes: 0 = conforms, 1 = violations, 2 = usage/parse error.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Parser, Store, DataFactory } from 'n3';
import rdf from 'rdf-ext';
import { Validator } from 'shacl-engine';

const HERE = dirname(fileURLToPath(import.meta.url));
const NS = {
  sc: 'https://w3id.org/jeswr/spec-companion#',
  spec: 'http://www.w3.org/ns/spec#',
  dcterms: 'http://purl.org/dc/terms/',
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
};

// ---------- CLI ----------
const args = process.argv.slice(2);
if (args.length === 0 || args[0].startsWith('--')) {
  console.error('usage: node validate.mjs <companion.ttl> [--shapes f] [--vocab f] [--spec-html f] [--quiet]');
  process.exit(2);
}
const companionPath = resolve(args[0]);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? resolve(args[i + 1]) : dflt;
};
const shapesPath = opt('--shapes', resolve(HERE, '../shapes/spec-companion.shape.ttl'));
const vocabPath = opt('--vocab', resolve(HERE, '../vocab/spec-companion.ttl'));
const specHtmlPath = args.includes('--spec-html') ? opt('--spec-html', null) : null;
const quiet = args.includes('--quiet');

const log = (...a) => { if (!quiet) console.log(...a); };

// ---------- parse ----------
function parseTurtle(path, baseIRI) {
  const text = readFileSync(path, 'utf8');
  const parser = new Parser({ baseIRI });
  return parser.parse(text);
}

// The companion's @base declares its canonical published IRI; give the parser a
// stable fallback base so relative IRIs resolve even without an @base line.
let companionQuads, vocabQuads, shapeQuads;
try {
  companionQuads = parseTurtle(companionPath, 'https://example.invalid/companion.ttl');
  vocabQuads = parseTurtle(vocabPath, NS.sc.slice(0, -1));
  shapeQuads = parseTurtle(shapesPath, 'https://w3id.org/jeswr/spec-companion/shape');
} catch (e) {
  console.error(`PARSE ERROR: ${e.message}`);
  process.exit(2);
}
log(`parsed: companion=${companionQuads.length} quads, vocab=${vocabQuads.length}, shapes=${shapeQuads.length}`);

const errors = [];
const warnings = [];

// ---------- SHACL ----------
const dataDataset = rdf.dataset([...companionQuads, ...vocabQuads]);
const shapesDataset = rdf.dataset(shapeQuads);
const validator = new Validator(shapesDataset, { factory: rdf });
const report = await validator.validate({ dataset: dataDataset });
if (!report.conforms) {
  for (const r of report.results) {
    const focus = r.focusNode?.value ?? '(unknown focus)';
    const path = r.path?.[0]?.predicates?.[0]?.value ?? r.path?.value ?? '';
    const msg = (r.message ?? []).map((m) => m.value).join('; ') || r.constraintComponent?.value || 'violation';
    errors.push(`SHACL: <${focus}>${path ? ` [${path}]` : ''}: ${msg}`);
  }
}

// ---------- graph helpers ----------
const store = new Store(companionQuads);
const nn = DataFactory.namedNode;
const objs = (s, p) => store.getObjects(s, nn(p), null);
const subjOf = (p, o) => store.getSubjects(nn(p), o, null);

const statements = store.getSubjects(nn(`${NS.rdf}type`), nn(`${NS.spec}Requirement`), null);
const companions = store.getSubjects(nn(`${NS.rdf}type`), nn(`${NS.sc}CompanionDocument`), null);

// ---------- G1: unique stable ids ----------
const seen = new Map();
for (const st of statements) {
  for (const id of objs(st, `${NS.dcterms}identifier`)) {
    if (seen.has(id.value)) {
      errors.push(`G1 duplicate id: "${id.value}" on <${st.value}> and <${seen.get(id.value)}>`);
    } else {
      seen.set(id.value, st.value);
    }
  }
}

// ---------- G2: anchors under the spec base ----------
const specBases = companions.flatMap((c) => objs(c, `${NS.sc}companionOf`)).map((t) => t.value);
if (specBases.length !== 1) {
  errors.push(`G2 expected exactly one sc:companionOf on the companion document, found ${specBases.length}`);
}
const specBase = specBases[0];
// Boundary-safe AND normalization-safe: both IRIs go through the WHATWG URL parser
// (which resolves dot segments, so "…/spec/../spec-evil#x" cannot lexically escape a
// directory base) and the anchor's NORMALIZED document part must BE the base document
// (trailing-slash tolerant) or, for a directory-style base ending in '/', a document
// under that directory. A bare startsWith would wrongly accept sibling documents like
// <https://example.org/spec-evil/> for base <https://example.org/spec>.
function anchorUnderBase(anchor, base) {
  let a, b;
  try {
    a = new URL(anchor);
    b = new URL(base);
  } catch {
    return { ok: false, why: 'or the spec base is not a parseable absolute URL' };
  }
  if (a.hash.length < 2) return { ok: false, why: 'has no (or an empty) fragment' };
  a.hash = '';
  b.hash = '';
  const doc = a.href;             // normalized: dot segments resolved, host lowercased
  const baseDoc = b.href;
  const baseNoSlash = baseDoc.endsWith('/') ? baseDoc.slice(0, -1) : baseDoc;
  const ok = doc === baseDoc || doc === baseNoSlash
    || (baseDoc.endsWith('/') && doc.startsWith(baseDoc));
  return { ok, why: ok ? '' : `is not under the spec base <${base}>` };
}
if (specBase) {
  const anchorProps = [`${NS.sc}anchor`, `${NS.sc}definedBy`];
  for (const prop of anchorProps) {
    for (const q of store.getQuads(null, nn(prop), null, null)) {
      const { ok, why } = anchorUnderBase(q.object.value, specBase);
      if (!ok) {
        errors.push(`G2 anchor <${q.object.value}> ${why} (on <${q.subject.value}>)`);
      }
    }
  }
}

// ---------- G5: statements linked from THE companion's spec node ----------
// The SHACL inverse-path constraint requires SOME spec:Specification to reference each
// statement; a decoy second Specification node would satisfy it while leaving the
// statement invisible from the sc:companionOf spec. Require the linkage from exactly
// the companionOf node.
if (specBase) {
  for (const st of statements) {
    const n = store.getQuads(nn(specBase), nn(`${NS.spec}requirement`), st, null).length;
    if (n !== 1) {
      errors.push(`G5 statement <${st.value}> is referenced ${n} time(s) via spec:requirement from the companion's spec <${specBase}> — required exactly once`);
    }
  }
}

// ---------- G3: RFC 2119 keyword/level consistency ----------
// Tokenize negated families first so their words never satisfy the positive family.
const FAMILIES = [
  { level: `${NS.spec}MUSTNOT`, name: 'MUST NOT', patterns: [/\bMUST NOT\b/g, /\bSHALL NOT\b/g] },
  { level: `${NS.spec}SHOULDNOT`, name: 'SHOULD NOT', patterns: [/\bSHOULD NOT\b/g, /\bNOT RECOMMENDED\b/g] },
  { level: `${NS.spec}MUST`, name: 'MUST', patterns: [/\bMUST\b/g, /\bSHALL\b/g, /\bREQUIRED\b/g] },
  { level: `${NS.spec}SHOULD`, name: 'SHOULD', patterns: [/\bSHOULD\b/g, /\bRECOMMENDED\b/g] },
  { level: `${NS.spec}MAY`, name: 'MAY', patterns: [/\bMAY\b/g, /\bOPTIONAL\b/g] },
];
function familyCounts(text) {
  let t = text;
  const counts = new Map();
  for (const fam of FAMILIES) {
    let n = 0;
    for (const p of fam.patterns) {
      t = t.replace(p, () => { n += 1; return '\u0000'; });
    }
    counts.set(fam.level, n);
  }
  return counts;
}
for (const st of statements) {
  const text = objs(st, `${NS.spec}statement`)[0]?.value;
  const level = objs(st, `${NS.spec}requirementLevel`)[0]?.value;
  if (!text || !level) continue; // SHACL already reports the absence
  const counts = familyCounts(text);
  if ((counts.get(level) ?? 0) === 0) {
    errors.push(`G3 <${st.value}>: statement text contains no keyword of its declared level <${level}>`);
  }
  for (const [lvl, n] of counts) {
    if (lvl !== level && n > 0) {
      warnings.push(`G3 <${st.value}>: quote also contains ${n} keyword(s) of foreign family <${lvl}> — split candidate`);
    }
  }
}

// ---------- G4: quote fidelity against the spec source ----------
function normalizeHtml(html) {
  return html
    .replace(/<[^>]+>/g, '')        // strip tags FIRST (so decoded '<' survives); the
                                    // pretty-printed sources keep whitespace outside
                                    // tags, and inline tags must not split words
                                    // ("<code>cb=none</code>;" must yield "cb=none;")
    .replace(/\[\[|\]\]/g, '')      // un-bracket ReSpec [[refs]]
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
}
if (specHtmlPath) {
  const specText = normalizeHtml(readFileSync(specHtmlPath, 'utf8'));
  for (const st of statements) {
    const text = objs(st, `${NS.spec}statement`)[0]?.value;
    if (!text) continue;
    const needle = text.replace(/\s+/g, ' ').trim();
    if (!specText.includes(needle)) {
      errors.push(`G4 <${st.value}>: statement text is not a verbatim quote of the spec source: "${needle.slice(0, 80)}..."`);
    }
  }
  log(`G4 quote fidelity checked against ${specHtmlPath}`);
} else {
  warnings.push('G4 skipped: no --spec-html given (quote fidelity unchecked)');
}

// ---------- report ----------
log(`statements: ${statements.length}; conformance classes: ${subjOf(`${NS.rdf}type`, nn(`${NS.sc}ConformanceClass`)).length}`);
for (const w of warnings) log(`WARN  ${w}`);
for (const e of errors) console.error(`ERROR ${e}`);
if (errors.length > 0) {
  console.error(`FAIL: ${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(1);
}
log(`PASS: 0 errors, ${warnings.length} warning(s)`);

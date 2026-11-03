// Minimal DOM stub + loader for the single-file UI.
//
// index.html has no build step and no module boundary: everything lives in one
// inline <script>. To test it we extract that script, run it inside a function
// with a hand-rolled DOM shim, and append an epilogue that hands the internals
// back. No browser, no dependencies.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const indexHtml = () => readFileSync(join(ROOT, "index.html"), "utf8");

/* ---------- selector matching (tag + classes, last compound only) ---------- */

function parseCompound(part) {
  const tag = (part.match(/^[a-zA-Z][\w-]*/) || [""])[0].toLowerCase();
  const classes = [...part.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
  const id = (part.match(/#([\w-]+)/) || [])[1];
  return { tag, classes, id };
}

function matchesCompound(el, c) {
  if (c.tag && el.tagName !== c.tag) return false;
  if (c.id && el.id !== c.id) return false;
  return c.classes.every((cl) => el.classList.contains(cl));
}

function matches(el, selector) {
  return selector.split(",").some((s) => {
    const parts = s.trim().split(/\s+/);
    return matchesCompound(el, parseCompound(parts[parts.length - 1]));
  });
}

/* ---------- element ---------- */

function makeEl(tagName, doc) {
  const handlers = new Map();
  const el = {
    tagName: String(tagName).toLowerCase(),
    nodeType: 1,
    id: "",
    children: [],
    parentNode: null,
    value: "",
    checked: false,
    disabled: false,
    placeholder: "",
    title: "",
    type: "",
    selected: false,
    scrollTop: 0,
    clientWidth: 300,
    offsetWidth: 300,
    offsetHeight: 20,
    style: new Proxy({}, { get: (t, k) => (k in t ? t[k] : ""), set: (t, k, v) => ((t[k] = v), true) }),
    dataset: {},
    _classes: new Set(),
    _text: "",
    _handlers: handlers,
  };
  el.classList = {
    add: (...c) => c.forEach((x) => el._classes.add(x)),
    remove: (...c) => c.forEach((x) => el._classes.delete(x)),
    contains: (c) => el._classes.has(c),
    toggle: (c, on) => {
      const want = on === undefined ? !el._classes.has(c) : !!on;
      want ? el._classes.add(c) : el._classes.delete(c);
      return want;
    },
  };
  Object.defineProperty(el, "className", {
    get: () => [...el._classes].join(" "),
    set: (v) => {
      el._classes = new Set(String(v).split(/\s+/).filter(Boolean));
    },
  });
  Object.defineProperty(el, "textContent", {
    get: () =>
      el.children.length ? el.children.map((c) => c.textContent).join("") : el._text,
    set: (v) => {
      el.children.forEach((c) => (c.parentNode = null));
      el.children = [];
      el._text = v === null || v === undefined ? "" : String(v);
    },
  });
  const adopt = (n) => {
    if (n.parentNode) n.remove();
    n.parentNode = el;
    el.children.push(n);
    el._text = "";
  };
  el.appendChild = (n) => (adopt(n), n);
  el.append = (...ns) => ns.forEach((n) => adopt(typeof n === "string" ? doc.createTextNode(n) : n));
  el.insertBefore = (n, ref) => {
    if (n.parentNode) n.remove();
    const i = ref ? el.children.indexOf(ref) : -1;
    n.parentNode = el;
    i < 0 ? el.children.push(n) : el.children.splice(i, 0, n);
    return n;
  };
  el.removeChild = (n) => {
    const i = el.children.indexOf(n);
    if (i >= 0) el.children.splice(i, 1);
    n.parentNode = null;
    return n;
  };
  el.remove = () => el.parentNode && el.parentNode.removeChild(el);
  el.contains = (n) => {
    for (let p = n; p; p = p.parentNode) if (p === el) return true;
    return false;
  };
  const walk = (node, out) => {
    for (const c of node.children || []) {
      out.push(c);
      walk(c, out);
    }
    return out;
  };
  el.querySelectorAll = (sel) => walk(el, []).filter((n) => n.nodeType === 1 && matches(n, sel));
  el.querySelector = (sel) => el.querySelectorAll(sel)[0] || null;
  el.matches = (sel) => matches(el, sel);
  el.closest = (sel) => {
    for (let p = el; p; p = p.parentNode) if (p.nodeType === 1 && matches(p, sel)) return p;
    return null;
  };
  el.setAttribute = (k, v) => (el[k] = v);
  el.getAttribute = (k) => (k in el ? el[k] : null);
  el.addEventListener = (t, fn) => {
    if (!handlers.has(t)) handlers.set(t, []);
    handlers.get(t).push(fn);
  };
  el.removeEventListener = (t, fn) => {
    const hs = handlers.get(t) || [];
    const i = hs.indexOf(fn);
    if (i >= 0) hs.splice(i, 1);
  };
  // dispatch(type) is the test-facing way to fire a listener the page registered
  el.dispatch = (t, evt = {}) => {
    const e = { type: t, target: el, currentTarget: el, preventDefault() {}, stopPropagation() {}, ...evt };
    (handlers.get(t) || []).forEach((fn) => fn(e));
    return e;
  };
  el.dispatchEvent = (e) => (el.dispatch(e.type, e), true);
  el.click = () => el.dispatch("click");
  el.focus = () => {};
  el.blur = () => {};
  el.select = () => {};
  el.scrollIntoView = () => {};
  el.requestSubmit = () => el.dispatch("submit");
  el.getBoundingClientRect = () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 });
  return el;
}

/* ---------- document / window / storage ---------- */

function makeDoc() {
  const byId = new Map();
  const handlers = new Map();
  const doc = {
    nodeType: 9,
    createElement: (t) => makeEl(t, doc),
    createTextNode: (t) => ({ nodeType: 3, parentNode: null, children: [], textContent: String(t), remove() {} }),
    getElementById: (id) => {
      if (!byId.has(id)) {
        const el = makeEl("div", doc);
        el.id = id;
        byId.set(id, el);
      }
      return byId.get(id);
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: (t, fn) => {
      if (!handlers.has(t)) handlers.set(t, []);
      handlers.get(t).push(fn);
    },
    removeEventListener: () => {},
    dispatch: (t, evt = {}) => {
      const e = { type: t, preventDefault() {}, stopPropagation() {}, ...evt };
      (handlers.get(t) || []).forEach((fn) => fn(e));
    },
    execCommand: () => false,
  };
  doc.body = makeEl("body", doc);
  doc.documentElement = makeEl("html", doc);
  return doc;
}

function makeStorage(seed = {}) {
  const map = new Map(Object.entries(seed).map(([k, v]) => [k, String(v)]));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
    get length() {
      return map.size;
    },
    _map: map,
  };
}

/* ---------- loader ---------- */

const EPILOGUE = `
return {
  TYPES, PRESETS, presetText, buildPrompt, quoteBlock, buildPresetRow,
  renderSummaryCard, renderCards, render, startReview, setGeneratedPrompt,
  saveDraft, loadDraft, restoreDraft, hasContent, allValid, addAnnotation,
  LANG_KEY, DRAFT_KEY,
  ORIGINAL_KEY: typeof ORIGINAL_KEY === "undefined" ? null : ORIGINAL_KEY,
  get text() { return text; },           set text(v) { text = v; },
  get annotations() { return annotations; }, set annotations(v) { annotations = v; },
  get summary() { return summary; },     set summary(v) { summary = v; },
  get presetLang() { return presetLang; }, set presetLang(v) { presetLang = v; },
  get includeOriginal() { return typeof includeOriginal === "undefined" ? undefined : includeOriginal; },
  get lastGenerated() { return lastGenerated; }, set lastGenerated(v) { lastGenerated = v; },
  get nextId() { return nextId; },
};
`;

export function loadApp({ storage = {}, html = indexHtml() } = {}) {
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("no inline <script> found in index.html");
  const document = makeDoc();
  const localStorage = makeStorage(storage);
  const window = {
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    getSelection: () => ({ rangeCount: 0, isCollapsed: true, removeAllRanges() {}, getRangeAt: () => null, toString: () => "" }),
    innerHeight: 800,
    innerWidth: 1200,
    addEventListener() {},
    location: { protocol: "file:", href: "file:///index.html" },
  };
  const navigator = { clipboard: { writeText: async () => {} }, userAgent: "node" };
  const fetch = () => Promise.reject(new Error("file:// — no server"));
  const confirm = () => true;
  const alert = () => {};
  const fn = new Function(
    "window", "document", "localStorage", "fetch", "navigator", "confirm", "alert",
    m[1] + EPILOGUE
  );
  const app = fn(window, document, localStorage, fetch, navigator, confirm, alert);
  return { app, document, localStorage, window, $: (id) => document.getElementById(id) };
}

/* ---------- CSS helper ---------- */

// Declarations for an exact selector in the top-level <style> block, in source
// order. Rules inside @media are skipped (nesting depth is tracked).
export function cssRule(selector, html = indexHtml()) {
  const style = html.match(/<style>([\s\S]*?)<\/style>/)[1].replace(/\/\*[\s\S]*?\*\//g, "");
  const out = [];
  let depth = 0, i = 0, head = "";
  while (i < style.length) {
    const ch = style[i];
    if (ch === "{") {
      const sel = head.trim();
      head = "";
      if (sel.startsWith("@")) { depth++; i++; continue; }
      const close = style.indexOf("}", i);
      const body = style.slice(i + 1, close);
      if (depth === 0 && sel.split(",").some((s) => s.trim() === selector)) out.push(body.trim());
      i = close + 1;
      continue;
    }
    if (ch === "}") { depth = Math.max(0, depth - 1); head = ""; i++; continue; }
    head += ch;
    i++;
  }
  return out;
}

export function cssDecl(selector, prop, html = indexHtml()) {
  const found = [];
  for (const body of cssRule(selector, html)) {
    for (const d of body.split(";")) {
      const [k, ...v] = d.split(":");
      if (k && k.trim() === prop) found.push(v.join(":").trim());
    }
  }
  return found.length ? found[found.length - 1] : null;
}

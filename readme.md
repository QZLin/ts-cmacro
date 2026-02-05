# ts-macro-script

> **Type-checked macro-expanded scripting for hostile JavaScript runtimes**

`ts-macro-script` lets you write large, maintainable scripts in **TypeScript**—with full type checking, IntelliSense, and modular structure—then **compile them into a single, flat, top‑level JavaScript file** that runs in environments which **do not support modules, bundlers, IIFE wrappers, or modern JS semantics**.

If your runtime only understands:

```js
function main(config) { /* ... */ }
```

…but you want to author your script like a real project, this tool is for you.

---

## Why this exists

Many real-world JavaScript runtimes are *hostile* to modern tooling:

* No `import` / `export`
* No module loader
* No filesystem or network I/O
* No control over the execution context
* Fragile or non-standard global scope handling

Examples include:

* Clash Verge / Clash Meta global scripts (boa engine)
* Surge / Loon / Quantumult X scripts
* Embedded JS engines (routers, IoT, NAS)
* WebView / injection-based environments
* Game scripting engines

In these environments, **bundlers break**, **IIFEs break**, and even `globalThis` may be unreliable.

The only stable contract is:

* A **single script file**
* With **top-level declarations**
* And a known entry function (e.g. `main`)

`ts-macro-script` embraces this reality instead of fighting it.

---

## Core idea

> **Treat TypeScript as a macro language, not a module system.**

* `import` is for **humans and tooling**, not the runtime
* The **global scope is the linker**
* All complexity is resolved at **build time**
* The runtime receives **flat, boring, predictable JavaScript**

Think:

* C + preprocessor + linker
* Lisp macros
* Old-school embedded scripting

…but with modern TypeScript ergonomics.

---

## What this tool does

Given an entry file like:

```ts
import { buildRules } from "./rules";
import type { ClashConfig } from "./types";

function main(config: ClashConfig) {
  config.rules = buildRules(config.rules ?? []);
  return config;
}
```

`ts-macro-script` will:

1. Parse the TypeScript program using the TypeScript Compiler API
2. Resolve `import` dependencies (relative paths only)
3. Topologically sort source files
4. **Remove all `import` and `export` syntax**
5. Concatenate declarations into a single output file
6. Optionally downlevel syntax (e.g. ES2019)

Resulting JavaScript:

```js
function buildRules(old) {
  return ["DOMAIN-SUFFIX,baidu.com,DIRECT", ...old];
}

function main(config) {
  config.rules = buildRules(config.rules ?? []);
  return config;
}
```

No wrappers. No modules. No runtime helpers.

---

## Non-goals (by design)

This project intentionally does **not**:

* ❌ Bundle dependencies like Webpack/Rollup
* ❌ Emit IIFE or UMD wrappers
* ❌ Polyfill runtime features
* ❌ Provide a module loader
* ❌ Modify runtime globals
* ❌ Optimize for browsers or Node

If you want a bundler, use a bundler.

This tool exists specifically for environments where bundlers **do not work**.

---

## Design principles

1. **Runtime minimalism**
   The output must be as simple as possible.

2. **Build-time maximalism**
   Complexity is allowed—encouraged—at build time.

3. **Deterministic output**
   The same input always produces the same script.

4. **Explicit over clever**
   No magic globals, no hidden runtime behavior.

5. **Hostile runtime first**
   If it works in a broken engine, it will work anywhere.

---

## Intended workflow

```text
src/
 ├─ rules.ts
 ├─ utils.ts
 └─ main.ts   ← entry

        ↓

pnpm ts-macro build src/main.ts

        ↓

dist/script.js   ← flat, top-level JS
```

You keep full IDE support:

* Type checking
* Go-to-definition
* Refactoring
* Code navigation

The runtime gets none of the complexity.

---

## Status

🚧 **Early design / MVP stage**

The initial version focuses on:

* Single entry point
* Relative imports
* Import/export stripping
* Ordered concatenation

Future features are explicitly out of scope until the core is proven stable.

---

## Who this is for

You may want this tool if:

* You write JS for constrained or embedded environments
* You maintain large configuration scripts
* You are tired of "just copy-paste everything into one file"
* You want TypeScript ergonomics without runtime cost

If your runtime supports modern ESM—**you probably don’t need this**.

---

## Philosophy summary

> **Use modern tools to generate primitive code.**

That’s it.

---

## License

GPLV3

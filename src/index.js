/**
 * @fileoverview SEAL â€” Main Module
 *
 * Exports the complete SEAL toolchain as a single coherent API.
 *
 * Consumers import only this file:
 *   const seal = require('seal-lang');
 *   const ast  = seal.parse(source);
 *   const html = seal.render(ast);
 *   // â€¦
 *
 * @module seal
 */

'use strict';

// â”€â”€ Sub-module references â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//
// The real parser and renderer modules live alongside this file.
// Loading is deferred until first call to keep boot cheap.

/** @type {import('./parser/index')} */
let _parserMod   = null;
/** @type {import('./renderer/index')} */
let _rendererMod = null;

function getParser() {
  if (!_parserMod) _parserMod = require('./parser/index');
  return _parserMod;
}

function getRenderer() {
  if (!_rendererMod) _rendererMod = require('./renderer/index');
  return _rendererMod;
}

// â”€â”€ Public API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Parse SEAL source text into an AST.
 *
 * Delegates to `src/parser/index.js`.
 *
 * @param {string} source - Raw SEAL markup text.
 * @returns {Object} AST root node (a `Page` element).
 * @throws {import('./parser/index').ParseError} On invalid SEAL syntax.
 *
 * @example
 * const ast = seal.parse(`
 * Page #home [title="Home"]
 *   Main
 *     Text "Hello"
 *   End Main
 * End Page
 * `);
 */
function parse(source) {
  return getParser().parse(source);
}

/**
 * Render an AST to an HTML string.
 *
 * The underlying renderer (`src/renderer/index.js`) returns
 * `{ html, css, manifest }`.  This function returns just the `html` string
 * for convenience.  Use {@link compile} when only HTML is needed, or call
 * the renderer directly if you need the full result object.
 *
 * @param {Object} ast        - AST previously returned by {@link parse}.
 * @param {Object} [options]  - Options forwarded to the renderer.
 * @returns {string} Full `<!DOCTYPE html>â€¦` page string.
 *
 * @example
 * const html = seal.render(ast);
 */
function render(ast, options) {
  const result = getRenderer().render(ast, options);
  // The renderer returns { html, css, manifest } â€” unwrap html for convenience.
  return result.html || result;
}

/**
 * Compile SEAL source text directly to HTML (shortcut for parse + render).
 *
 * @param {string} source     - Raw SEAL markup text.
 * @param {Object} [options]  - Options forwarded to the renderer.
 * @returns {string} Full HTML page string.
 *
 * @example
 * const html = seal.compile(sealSource);
 */
function compile(source, options) {
  return render(parse(source), options);
}

/**
 * Extract the AI action manifest from an AST.
 *
 * The manifest is a JSON-serialisable object describing every interactive
 * element on the page together with the AI commands it supports.
 *
 * Internally calls the renderer, which produces the manifest as a side-effect
 * of rendering.  The HTML output is discarded.
 *
 * @param {Object} ast        - AST previously returned by {@link parse}.
 * @param {Object} [options]  - Options forwarded to the renderer.
 * @returns {Object} Manifest object with shape:
 *   `{ title, route, lang, actions: [{ id, type, actions[], label? }] }`
 *
 * @example
 * const mf = seal.manifest(ast);
 * // mf.actions â†’ [{ id: "email", type: "Input", actions: ["FILL", "CLEAR", â€¦] }, â€¦]
 */
function manifest(ast, options) {
  const result = getRenderer().render(ast, options);
  // renderer returns { html, css, manifest }
  return result.manifest || result;
}

/**
 * Execute one or more AI commands against a SEAL page (represented as an AST).
 *
 * Parses the `commandSource` string using the SEAL AI protocol parser, then
 * runs each command through the executor to produce Playwright / Puppeteer /
 * Fetch code snippets.
 *
 * @param {string} commandSource - SEAL command string (may be multi-line or
 *   contain SEQUENCE blocks).
 * @param {Object} [ast]         - Optional AST; reserved for future
 *   manifest-aware validation.
 * @returns {import('./ai-protocol/executor').ExecutionResult[]}
 *
 * @example
 * const results = seal.execute('FILL #email WITH "user@example.com"\nCLICK #submit-btn');
 * results[0].playwright // â†’ `await page.fill('[data-seal-id="email"]', 'user@example.com');`
 */
function execute(commandSource, ast) { // eslint-disable-line no-unused-vars
  const { parse: parseCmd }  = require('./ai-protocol/index');
  const { executeAll }       = require('./ai-protocol/executor');
  const commands = parseCmd(commandSource);
  return executeAll(commands);
}

/**
 * Interpret a natural-language instruction (or array of instructions) into
 * SEAL command strings.
 *
 * Uses pattern-matching rules; no LLM required for common interactions.
 *
 * @param {string|string[]} instruction - Plain-English instruction(s).
 * @returns {string[]} Array of SEAL command strings.
 *
 * @example
 * seal.interpret('Login with email test@gmail.com and password 123456')
 * // â†’ ["FILL #email WITH 'test@gmail.com'", "FILL #password WITH '123456'",
 * //    "CLICK #submit-btn", "WAIT FOR navigation"]
 *
 * @example
 * seal.interpret('Select Thailand from the country dropdown')
 * // â†’ ["SELECT #country WITH 'Thailand'"]
 */
function interpret(instruction) {
  const { interpret: _interpret, interpretAll } = require('./ai-protocol/interpreter');
  if (Array.isArray(instruction)) return interpretAll(instruction);
  return _interpret(instruction);
}

/**
 * Validate SEAL source text.
 *
 * Attempts to parse the source and reports any `ParseError` instances as
 * structured error messages.  Returns a `{ valid, errors, warnings }` object.
 *
 * @param {string} source - Raw SEAL markup text.
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 *
 * @example
 * const result = seal.validate(source);
 * if (!result.valid) console.error(result.errors);
 */
function validate(source) {
  if (typeof source !== 'string' || source.trim().length === 0) {
    return {
      valid:    false,
      errors:   ['Source is empty or not a string.'],
      warnings: [],
    };
  }
  try {
    getParser().parse(source);
    return { valid: true, errors: [], warnings: [] };
  } catch (err) {
    return {
      valid:    false,
      errors:   [err.message || String(err)],
      warnings: [],
    };
  }
}

// ── Module exports ────────────────────────────────────────────────────────────

module.exports = {
  parse,
  render,
  compile,
  manifest,
  execute,
  interpret,
  validate,
  scan,
};

/**
 * Scan the DOM for SEAL-compatible elements.
 * @param {Document|HTMLElement} [root]
 */
function scan(root) {
  return require('./bridge/index').scan(root);
}


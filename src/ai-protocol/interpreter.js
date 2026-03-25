/**
 * @fileoverview SEAL Natural-Language Interpreter
 *
 * Converts plain-English instructions into SEAL AI command strings using
 * pattern-matching rules — no LLM required for common cases.
 *
 * @module seal/ai-protocol/interpreter
 */

'use strict';

// ── Pattern rule helpers ───────────────────────────────────────────────────────

/**
 * @typedef {Object} InterpretRule
 * @property {RegExp}   pattern  - Regex tested against the lower-cased input.
 * @property {function(RegExpMatchArray, string): string[]} build
 *   Receives the match array and the original (cased) input; returns an array
 *   of SEAL command strings.
 */

/**
 * Normalise a value captured from natural language for use in SEAL commands.
 * Wraps the value in single quotes unless it already starts with `$`.
 *
 * @param {string} val - Raw captured value.
 * @returns {string} Quoted or variable reference.
 */
function q(val) {
  if (!val) return "''";
  const trimmed = val.trim();
  if (trimmed.startsWith('$')) return trimmed;
  return `'${trimmed.replace(/'/g, "\\'")}'`;
}

// ── Rule table ─────────────────────────────────────────────────────────────────

/**
 * Ordered list of pattern-matching rules.  Rules are evaluated top-to-bottom;
 * the first match wins.
 *
 * @type {InterpretRule[]}
 */
const RULES = [

  // ── Login / sign-in ─────────────────────────────────────────────────────────
  {
    // "login with email X and password Y"
    // "sign in using email X password Y"
    // "log in as X / Y"
    pattern: /(?:log(?:in| in)|sign[\s-]?in|authenticate)(?:\s+(?:with|using|as))?(?:.*?(?:email|username|user)\s+([^\s,]+))?(?:.*?password\s+([^\s,]+))?/i,
    build(m) {
      const commands = [];
      const email = m[1];
      const pass  = m[2];
      if (email) commands.push(`FILL #email WITH ${q(email)}`);
      if (pass)  commands.push(`FILL #password WITH ${q(pass)}`);
      commands.push('CLICK #submit-btn');
      commands.push('WAIT FOR navigation');
      return commands;
    },
  },

  // ── Fill / enter / type a field ─────────────────────────────────────────────
  {
    // "fill in the email with test@example.com"
    // "enter 'hello' in the name field"
    // "type 12345 into the zip code input"
    // "set username to john"
    pattern: /(?:fill\s+(?:in\s+)?(?:the\s+)?|enter\s+(?:.*?\s+in(?:to)?\s+(?:the\s+)?)|type\s+(?:.*?\s+into\s+(?:the\s+)?)|set\s+(?:the\s+)?)([\w\s-]+?)(?:\s+(?:field|input|box|area))?\s+(?:with|to|=)\s+['""]?([^'"",]+)['""]?/i,
    build(m) {
      const fieldRaw = m[1].trim().toLowerCase().replace(/\s+/g, '-');
      const val      = m[2].trim();
      return [`FILL #${fieldRaw} WITH ${q(val)}`];
    },
  },

  // Simpler: "enter 'value' in #id" or "type 'value' in the email"
  {
    pattern: /(?:enter|type|input|write)\s+['"]?([^'"]+)['"]?\s+(?:in(?:to)?|for)\s+(?:the\s+)?(?:#([\w-]+)|([\w\s-]+?)(?:\s+(?:field|input|box))?)\s*$/i,
    build(m) {
      const val      = m[1].trim();
      const idRaw    = m[2] || m[3].trim().toLowerCase().replace(/\s+/g, '-');
      return [`FILL #${idRaw} WITH ${q(val)}`];
    },
  },

  // ── Click ────────────────────────────────────────────────────────────────────
  {
    // "click the submit button"  /  "press login"  /  "tap on #btn"
    pattern: /(?:click|press|tap(?:\s+on)?)\s+(?:the\s+)?(?:#([\w-]+)|([\w\s-]+?)(?:\s+(?:button|btn|link))?)\s*$/i,
    build(m) {
      const id = m[1] || m[2].trim().toLowerCase().replace(/\s+/g, '-');
      return [`CLICK #${id}`];
    },
  },

  // ── Select / choose ──────────────────────────────────────────────────────────
  {
    // "select Thailand from the country dropdown"
    // "choose option 2 in the size select"
    // "pick 'Large' in the size field"
    pattern: /(?:select|choose|pick)\s+(?:option\s+(\d+)|['"]?([^'"]+?)['"]?)\s+(?:from|in(?:to)?)\s+(?:the\s+)?(?:#([\w-]+)|([\w\s-]+?)(?:\s+(?:dropdown|select|field|list))?)\s*$/i,
    build(m) {
      const idxRaw   = m[1]; // numeric index
      const label    = m[2] ? m[2].trim() : null;
      const idRaw    = m[3] || (m[4] ? m[4].trim().toLowerCase().replace(/\s+/g, '-') : 'select');
      if (idxRaw !== undefined && idxRaw !== null) {
        return [`SELECT #${idRaw} WITH index=${idxRaw}`];
      }
      return [`SELECT #${idRaw} WITH ${q(label)}`];
    },
  },

  // ── Check / uncheck / toggle ─────────────────────────────────────────────────
  {
    pattern: /^(check|tick)\s+(?:the\s+)?(?:#([\w-]+)|([\w\s-]+?)(?:\s+checkbox)?)\s*$/i,
    build(m) {
      const id = m[2] || m[3].trim().toLowerCase().replace(/\s+/g, '-');
      return [`CHECK #${id}`];
    },
  },
  {
    pattern: /^(uncheck|untick|deselect)\s+(?:the\s+)?(?:#([\w-]+)|([\w\s-]+?)(?:\s+checkbox)?)\s*$/i,
    build(m) {
      const id = m[2] || m[3].trim().toLowerCase().replace(/\s+/g, '-');
      return [`UNCHECK #${id}`];
    },
  },
  {
    pattern: /^toggle\s+(?:the\s+)?(?:#([\w-]+)|([\w\s-]+?)(?:\s+checkbox)?)\s*$/i,
    build(m) {
      const id = m[1] || m[2].trim().toLowerCase().replace(/\s+/g, '-');
      return [`TOGGLE #${id}`];
    },
  },

  // ── Navigate ─────────────────────────────────────────────────────────────────
  {
    pattern: /^(?:go\s+)?back\s*$/i,
    build() { return ['NAVIGATE BACK']; },
  },
  {
    pattern: /^(?:go\s+)?forward\s*$/i,
    build() { return ['NAVIGATE FORWARD']; },
  },
  {
    // Must come AFTER back/forward rules
    pattern: /^(?:go|navigate|open|visit)\s+(?:to\s+)?['"]?([/\w\-.?=#&]+)['"]?\s*$/i,
    build(m) {
      return [`NAVIGATE TO '${m[1]}'`];
    },
  },
  {
    pattern: /^(?:reload|refresh)\s+(?:the\s+)?(?:page)?\s*$/i,
    build() { return ['RELOAD']; },
  },

  // ── Scroll ───────────────────────────────────────────────────────────────────
  {
    pattern: /^scroll\s+(?:to\s+)?(?:the\s+)?top\s*$/i,
    build() { return ['SCROLL TO top']; },
  },
  {
    pattern: /^scroll\s+(?:to\s+)?(?:the\s+)?bottom\s*$/i,
    build() { return ['SCROLL TO bottom']; },
  },
  {
    pattern: /^scroll\s+(?:down\s+)?(?:by\s+)?(\d+)(?:\s*px)?\s*$/i,
    build(m) { return [`SCROLL BY ${m[1]}`]; },
  },
  {
    pattern: /^scroll\s+to\s+(?:#([\w-]+)|([\w\s-]+?)(?:\s+section)?)\s*$/i,
    build(m) {
      const id = m[1] || m[2].trim().toLowerCase().replace(/\s+/g, '-');
      return [`SCROLL TO #${id}`];
    },
  },

  // ── Submit form ──────────────────────────────────────────────────────────────
  {
    pattern: /^submit\s+(?:the\s+)?(?:#([\w-]+)|([\w\s-]+?))?\s*form\s*$/i,
    build(m) {
      const id = m[1] || (m[2] ? m[2].trim().toLowerCase().replace(/\s+/g, '-') : 'form');
      return [`SUBMIT #${id}`];
    },
  },

  // ── Read / inspect ───────────────────────────────────────────────────────────
  {
    pattern: /^(?:read|get|fetch|show)\s+(?:the\s+)?page(?:\s+manifest)?\s*$/i,
    build() { return ['READ PAGE']; },
  },
  {
    pattern: /^(?:read|inspect|get)\s+(?:the\s+)?(?:#([\w-]+)|([\w\s-]+?)(?:\s+element)?)?\s*$/i,
    build(m) {
      const id = m[1] || (m[2] ? m[2].trim().toLowerCase().replace(/\s+/g, '-') : null);
      if (!id) return ['READ PAGE'];
      return [`READ #${id}`];
    },
  },

  // ── List ─────────────────────────────────────────────────────────────────────
  {
    pattern: /^(?:list|show)\s+(?:all\s+)?(actions|inputs?|buttons?|forms?)\s*(?:on\s+(?:the\s+)?page)?\s*$/i,
    build(m) {
      const kind   = m[1].toLowerCase().replace(/s$/, '') + 's'; // normalise plural
      const mapped = { actions: 'ACTIONS', inputs: 'INPUTS', buttons: 'BUTTONS', forms: 'INPUTS' }[kind] || 'ACTIONS';
      return [`LIST ${mapped}`];
    },
  },
  {
    pattern: /^what\s+are\s+the\s+(actions|inputs?|buttons?|forms?)\s*(?:on\s+(?:the\s+)?page)?\s*$/i,
    build(m) {
      const kind   = m[1].toLowerCase().replace(/s$/, '') + 's';
      const mapped = { actions: 'ACTIONS', inputs: 'INPUTS', buttons: 'BUTTONS', forms: 'INPUTS' }[kind] || 'ACTIONS';
      return [`LIST ${mapped}`];
    },
  },

  // ── Wait ─────────────────────────────────────────────────────────────────────
  {
    pattern: /^wait\s+(?:for\s+)?(\d+)(?:\s*(?:ms|milliseconds?|seconds?))?\s*$/i,
    build(m, original) {
      const num = parseInt(m[1], 10);
      const ms  = /seconds?/i.test(original) ? num * 1000 : num;
      return [`WAIT FOR ms=${ms}`];
    },
  },
  {
    pattern: /^wait\s+(?:for\s+)?(?:the\s+)?page(?:\s+to\s+load)?\s*$/i,
    build() { return ['WAIT FOR navigation']; },
  },
  {
    pattern: /^wait\s+(?:for\s+)?(?:the\s+)?(?:#([\w-]+)|([\w\s-]+?))(?:\s+(?:to\s+appear|to\s+load|element))?\s*$/i,
    build(m) {
      const id = m[1] || (m[2] ? m[2].trim().toLowerCase().replace(/\s+/g, '-') : null);
      if (!id) return ['WAIT FOR navigation'];
      return [`WAIT FOR #${id}`];
    },
  },

  // ── Register / sign up (compound) ────────────────────────────────────────────
  {
    pattern: /(?:register|sign\s*up|create\s+(?:an?\s+)?account)(?:.*?(?:email|username|user)\s+([^\s,]+))?(?:.*?password\s+([^\s,]+))?/i,
    build(m) {
      const commands = [];
      if (m[1]) commands.push(`FILL #email WITH ${q(m[1])}`);
      if (m[2]) commands.push(`FILL #password WITH ${q(m[2])}`);
      commands.push('CLICK #submit-btn');
      commands.push('WAIT FOR navigation');
      return commands;
    },
  },

  // ── Clear a field ────────────────────────────────────────────────────────────
  {
    pattern: /^clear\s+(?:the\s+)?(?:#([\w-]+)|([\w\s-]+?)(?:\s+(?:field|input|box))?)\s*$/i,
    build(m) {
      const id = m[1] || (m[2] ? m[2].trim().toLowerCase().replace(/\s+/g, '-') : null);
      if (!id) return [];
      return [`CLEAR #${id}`];
    },
  },

  // ── Focus ────────────────────────────────────────────────────────────────────
  {
    pattern: /^focus\s+(?:on\s+)?(?:the\s+)?(?:#([\w-]+)|([\w\s-]+?)(?:\s+(?:field|input))?)?\s*$/i,
    build(m) {
      const id = m[1] || (m[2] ? m[2].trim().toLowerCase().replace(/\s+/g, '-') : null);
      if (!id) return [];
      return [`FOCUS #${id}`];
    },
  },
];

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Interpret a natural-language instruction and return an array of SEAL command
 * strings.
 *
 * Uses a priority-ordered set of regex rules.  If no rule matches, returns an
 * empty array and emits a console warning so callers can handle the fallback.
 *
 * @param {string} instruction - Plain-English instruction, e.g.
 *   `"Login with email test@gmail.com and password 123456"`.
 * @returns {string[]} Array of SEAL command strings ready to be passed to
 *   {@link module:seal/ai-protocol.parse}.
 *
 * @example
 * interpret('Login with email user@test.com and password secret')
 * // → ["FILL #email WITH 'user@test.com'", "FILL #password WITH 'secret'", "CLICK #submit-btn", "WAIT FOR navigation"]
 *
 * @example
 * interpret('Select Thailand from the country dropdown')
 * // → ["SELECT #country WITH 'Thailand'"]
 */
function interpret(instruction) {
  if (!instruction || typeof instruction !== 'string') return [];

  const trimmed = instruction.trim();

  for (const rule of RULES) {
    const m = trimmed.match(rule.pattern);
    if (m) {
      const result = rule.build(m, trimmed);
      // Filter out null/undefined/empty entries
      return result.filter(Boolean);
    }
  }

  // Fallback: no rule matched
  // eslint-disable-next-line no-console
  console.warn(`[SEAL interpreter] No rule matched: "${trimmed}"`);
  return [];
}

/**
 * Interpret multiple instructions in sequence and return a flat array of all
 * resulting SEAL commands.
 *
 * @param {string[]} instructions - Array of plain-English instructions.
 * @returns {string[]} Flat array of SEAL command strings.
 */
function interpretAll(instructions) {
  return instructions.flatMap(interpret);
}

module.exports = { interpret, interpretAll };

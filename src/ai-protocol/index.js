/**
 * @fileoverview SEAL AI Action Protocol
 *
 * A simple, unambiguous command language that AI agents use to interact with
 * SEAL pages. Provides parsing, validation, and dispatching of SEAL commands.
 *
 * Command syntax:
 *   COMMAND [TARGET] [WITH value] [OPTIONS]
 *
 * @module seal/ai-protocol
 */

'use strict';

// ── Imports ────────────────────────────────────────────────────────────────────

const { execute }    = require('./executor');
const { interpret }  = require('./interpreter');

// ── Command token constants ────────────────────────────────────────────────────

/**
 * All valid top-level command tokens recognised by the SEAL AI protocol.
 * @enum {string}
 */
const COMMANDS = Object.freeze({
  // Navigation
  NAVIGATE:  'NAVIGATE',
  RELOAD:    'RELOAD',

  // Form interactions
  FILL:      'FILL',
  CLEAR:     'CLEAR',
  FOCUS:     'FOCUS',
  BLUR:      'BLUR',

  // Button / link actions
  CLICK:     'CLICK',
  HOVER:     'HOVER',

  // Selection
  SELECT:    'SELECT',
  CHECK:     'CHECK',
  UNCHECK:   'UNCHECK',
  TOGGLE:    'TOGGLE',

  // Scroll
  SCROLL:    'SCROLL',

  // Form control
  SUBMIT:    'SUBMIT',
  RESET:     'RESET',
  VALIDATE:  'VALIDATE',

  // Page reading
  READ:      'READ',
  LIST:      'LIST',
  FIND:      'FIND',

  // Wait
  WAIT:      'WAIT',

  // Multi-step sequence
  SEQUENCE:  'SEQUENCE',
});

/**
 * Preposition keywords that introduce values or sub-targets.
 * @enum {string}
 */
const PREPOSITIONS = Object.freeze({
  TO:   'TO',
  WITH: 'WITH',
  FOR:  'FOR',
  BY:   'BY',
});

// ── Tokeniser ─────────────────────────────────────────────────────────────────

/**
 * Tokenise a single SEAL command line into an array of tokens.
 *
 * Handles:
 *  - Quoted strings  → token with type 'string'
 *  - $variables      → token with type 'variable'
 *  - key=value pairs → token with type 'keypair'
 *  - #id / .class    → token with type 'selector'
 *  - Plain words     → token with type 'keyword'
 *
 * @param {string} line - Raw command line text.
 * @returns {Array<{type: string, value: string, raw: string}>}
 */
function tokenise(line) {
  const tokens = [];
  // Regex: quoted strings | $vars | key=value | word-chars (including # . /)
  const re = /"([^"\\]*(\\.[^"\\]*)*)"|'([^'\\]*(\\.[^'\\]*)*)'|\$[\w.]+|[\w#./\-]+=[\w"'.@\-]+|[^\s"'$]+/g;
  let m;
  while ((m = re.exec(line.trim())) !== null) {
    const raw = m[0];

    if (raw.startsWith('"') || raw.startsWith("'")) {
      // Strip surrounding quotes
      tokens.push({ type: 'string', value: raw.slice(1, -1), raw });
    } else if (raw.startsWith('$')) {
      tokens.push({ type: 'variable', value: raw, raw });
    } else if (/^#[\w\-]+$/.test(raw)) {
      tokens.push({ type: 'selector', value: raw, raw });
    } else if (/^\.[.\w\-]+$/.test(raw)) {
      tokens.push({ type: 'selector', value: raw, raw });
    } else if (/^[\w\-]+=.+$/.test(raw)) {
      const eq   = raw.indexOf('=');
      const key   = raw.slice(0, eq);
      const val   = raw.slice(eq + 1).replace(/^["']|["']$/g, '');
      tokens.push({ type: 'keypair', key, value: val, raw });
    } else {
      tokens.push({ type: 'keyword', value: raw.toUpperCase(), raw });
    }
  }
  return tokens;
}

// ── Parser ────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ParsedCommand
 * @property {string}            command    - Upper-case command token.
 * @property {string|null}       target     - CSS selector target, if any.
 * @property {string|null}       value      - WITH/TO/BY value, if any.
 * @property {Object}            options    - Additional key=value options.
 * @property {string}            raw        - Original source line.
 * @property {ParsedCommand[]}   [body]     - Commands inside a SEQUENCE block.
 */

/**
 * Parse a single command line into a structured ParsedCommand object.
 *
 * @param {string} line - A single SEAL command line (no leading whitespace
 *   required, but SEQUENCE body lines are handled separately by parseSequence).
 * @returns {ParsedCommand}
 * @throws {Error} If the command token is unrecognised.
 */
function parseLine(line) {
  const tokens  = tokenise(line);
  if (tokens.length === 0) return null;

  const first = tokens[0];
  if (first.type !== 'keyword' || !COMMANDS[first.value]) {
    throw new Error(`Unknown SEAL command: "${first.raw}" in line: "${line}"`);
  }

  const cmd = {
    command: first.value,
    target:  null,
    value:   null,
    options: {},
    raw:     line.trim(),
  };

  let i = 1;

  // Helper: peek at next token
  const peek = () => tokens[i];

  // ── NAVIGATE ──────────────────────────────────────────────────────────────
  if (cmd.command === COMMANDS.NAVIGATE) {
    // NAVIGATE TO "/path"  |  NAVIGATE BACK  |  NAVIGATE FORWARD
    const next = peek();
    if (next && next.type === 'keyword') {
      if (next.value === 'TO') {
        i++; // consume TO
        const dest = tokens[i];
        if (dest) {
          cmd.value = dest.value;
          i++;
        }
      } else if (next.value === 'BACK' || next.value === 'FORWARD') {
        cmd.value = next.value.toLowerCase();
        i++;
      }
    }
  }

  // ── Commands with an optional selector target ────────────────────────────
  else if ([
    COMMANDS.FILL, COMMANDS.CLEAR, COMMANDS.FOCUS, COMMANDS.BLUR,
    COMMANDS.CLICK, COMMANDS.HOVER,
    COMMANDS.SELECT, COMMANDS.CHECK, COMMANDS.UNCHECK, COMMANDS.TOGGLE,
    COMMANDS.SUBMIT, COMMANDS.RESET, COMMANDS.VALIDATE,
  ].includes(cmd.command)) {
    if (peek() && peek().type === 'selector') {
      cmd.target = peek().value;
      i++;
    }
    // WITH value
    if (peek() && peek().type === 'keyword' && peek().value === 'WITH') {
      i++; // consume WITH
      if (peek()) {
        const val = peek();
        if (val.type === 'keypair') {
          // index=2  or  value="x"
          cmd.options[val.key] = val.value;
        } else {
          cmd.value = val.value;
        }
        i++;
      }
    }
  }

  // ── SCROLL ────────────────────────────────────────────────────────────────
  else if (cmd.command === COMMANDS.SCROLL) {
    // SCROLL TO #section | SCROLL TO top | SCROLL TO bottom | SCROLL BY 500
    if (peek() && peek().type === 'keyword') {
      const prep = peek().value; // TO or BY
      i++;
      if (peek()) {
        if (prep === 'BY') {
          cmd.options.by = parseInt(peek().value, 10) || 0;
        } else {
          // TO
          if (peek().type === 'selector') {
            cmd.target = peek().value;
          } else {
            cmd.value = peek().value.toLowerCase(); // "top" | "bottom"
          }
        }
        i++;
      }
    }
  }

  // ── READ ──────────────────────────────────────────────────────────────────
  else if (cmd.command === COMMANDS.READ) {
    // READ PAGE | READ #element | READ FORM #form
    if (peek()) {
      if (peek().type === 'keyword' && peek().value === 'PAGE') {
        cmd.value = 'page';
        i++;
      } else if (peek().type === 'keyword' && peek().value === 'FORM') {
        cmd.value = 'form';
        i++;
        if (peek() && peek().type === 'selector') {
          cmd.target = peek().value;
          i++;
        }
      } else if (peek().type === 'selector') {
        cmd.target = peek().value;
        i++;
      }
    }
  }

  // ── LIST ──────────────────────────────────────────────────────────────────
  else if (cmd.command === COMMANDS.LIST) {
    // LIST ACTIONS | LIST INPUTS | LIST BUTTONS
    if (peek() && peek().type === 'keyword') {
      cmd.value = peek().value.toLowerCase(); // actions | inputs | buttons
      i++;
    }
  }

  // ── FIND ──────────────────────────────────────────────────────────────────
  else if (cmd.command === COMMANDS.FIND) {
    // FIND type=Input | FIND label="Email"
    while (peek()) {
      const tok = peek();
      if (tok.type === 'keypair') {
        cmd.options[tok.key] = tok.value;
      } else {
        break;
      }
      i++;
    }
  }

  // ── WAIT ──────────────────────────────────────────────────────────────────
  else if (cmd.command === COMMANDS.WAIT) {
    // WAIT FOR #element | WAIT FOR navigation | WAIT FOR ms=1000 | WAIT FOR condition="..."
    if (peek() && peek().type === 'keyword' && peek().value === 'FOR') {
      i++; // consume FOR
      if (peek()) {
        const tok = peek();
        if (tok.type === 'selector') {
          cmd.target = tok.value;
        } else if (tok.type === 'keypair') {
          cmd.options[tok.key] = tok.value;
        } else {
          cmd.value = tok.value.toLowerCase(); // "navigation"
        }
        i++;
      }
    }
  }

  // ── SEQUENCE ─────────────────────────────────────────────────────────────
  else if (cmd.command === COMMANDS.SEQUENCE) {
    // SEQUENCE #id  (body parsed separately by parseSequence)
    if (peek() && peek().type === 'selector') {
      cmd.target = peek().value;
      i++;
    } else if (peek() && peek().type === 'keyword') {
      cmd.target = '#' + peek().value.toLowerCase();
      i++;
    }
    cmd.body = []; // will be filled by parseSequence
  }

  // Collect any remaining keypair options
  while (tokens[i]) {
    const tok = tokens[i];
    if (tok.type === 'keypair') {
      cmd.options[tok.key] = tok.value;
    }
    i++;
  }

  return cmd;
}

/**
 * Parse a multi-line SEAL command string that may contain SEQUENCE blocks.
 *
 * @param {string} source - Multi-line SEAL command text.
 * @returns {ParsedCommand[]} Array of parsed commands.
 * @throws {Error} On unbalanced SEQUENCE / END SEQUENCE blocks.
 */
function parse(source) {
  const lines  = source
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('//'));

  const result  = [];
  let   i       = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^SEQUENCE\b/i.test(line)) {
      const seqCmd = parseLine(line);
      i++;
      // Collect body until END SEQUENCE
      while (i < lines.length && !/^END\s+SEQUENCE\b/i.test(lines[i])) {
        const bodyCmd = parseLine(lines[i]);
        if (bodyCmd) seqCmd.body.push(bodyCmd);
        i++;
      }
      if (i >= lines.length) {
        throw new Error('Unterminated SEQUENCE block — missing END SEQUENCE');
      }
      i++; // consume END SEQUENCE
      result.push(seqCmd);
    } else if (/^END\s+SEQUENCE\b/i.test(line)) {
      throw new Error('Unexpected END SEQUENCE without matching SEQUENCE');
    } else {
      const cmd = parseLine(line);
      if (cmd) result.push(cmd);
      i++;
    }
  }

  return result;
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  COMMANDS,
  PREPOSITIONS,
  tokenise,
  parseLine,
  parse,
  execute,
  interpret,
};

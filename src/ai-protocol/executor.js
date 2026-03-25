/**
 * @fileoverview SEAL AI Command Executor
 *
 * Executes parsed SEAL AI commands against a page manifest (for simulation /
 * testing) and generates corresponding browser-automation code snippets for
 * Playwright, Puppeteer, and Fetch/API targets.
 *
 * @module seal/ai-protocol/executor
 */

'use strict';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Convert a SEAL CSS-style selector (e.g. `#email`) into a
 * `[data-seal-id="…"]` attribute selector string used in generated code.
 *
 * If the selector is already a CSS class or complex expression it is returned
 * as-is so the generator stays valid.
 *
 * @param {string} selector - A selector string like `#my-id` or `.my-class`.
 * @returns {string} Attribute selector or original selector.
 */
function sealSelector(selector) {
  if (!selector) return '';
  if (selector.startsWith('#')) {
    const id = selector.slice(1);
    return `[data-seal-id="${id}"]`;
  }
  return selector; // class selectors, etc. pass through unchanged
}

/**
 * Escape a string value for safe embedding inside a JavaScript template literal
 * or quoted string literal in generated code.
 *
 * @param {string} val - Raw value.
 * @returns {string} Escaped value.
 */
function escStr(val) {
  if (val === undefined || val === null) return '';
  return String(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
}

// ── Code generators per command ───────────────────────────────────────────────

/**
 * @typedef {Object} ExecutionResult
 * @property {string}      command      - Upper-case command token.
 * @property {string|null} target       - CSS selector target.
 * @property {string|null} value        - Resolved value.
 * @property {Object}      options      - Extra options map.
 * @property {string}      playwright   - Generated Playwright code snippet.
 * @property {string}      puppeteer    - Generated Puppeteer code snippet.
 * @property {string}      fetch        - Generated Fetch/API code (if applicable).
 * @property {string}      description  - Human-readable description.
 */

/**
 * Generate code snippets for a FILL command.
 *
 * @param {import('./index').ParsedCommand} cmd
 * @returns {ExecutionResult}
 */
function genFill(cmd) {
  const sel  = sealSelector(cmd.target);
  const val  = escStr(cmd.value);
  return {
    playwright:  `await page.fill('${sel}', '${val}');`,
    puppeteer:   `await page.$eval('${sel}', (el) => { el.value = '${val}'; el.dispatchEvent(new Event('input', { bubbles: true })); });`,
    fetch:       null,
    description: `Fill ${cmd.target} with '${cmd.value}'`,
  };
}

/**
 * Generate code snippets for a CLEAR command.
 * @param {import('./index').ParsedCommand} cmd
 * @returns {ExecutionResult}
 */
function genClear(cmd) {
  const sel = sealSelector(cmd.target);
  return {
    playwright:  `await page.fill('${sel}', '');`,
    puppeteer:   `await page.$eval('${sel}', (el) => { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); });`,
    fetch:       null,
    description: `Clear ${cmd.target}`,
  };
}

/**
 * Generate code snippets for a FOCUS command.
 * @param {import('./index').ParsedCommand} cmd
 * @returns {ExecutionResult}
 */
function genFocus(cmd) {
  const sel = sealSelector(cmd.target);
  return {
    playwright:  `await page.focus('${sel}');`,
    puppeteer:   `await page.$eval('${sel}', (el) => el.focus());`,
    fetch:       null,
    description: `Focus ${cmd.target}`,
  };
}

/**
 * Generate code snippets for a BLUR command.
 * @param {import('./index').ParsedCommand} cmd
 * @returns {ExecutionResult}
 */
function genBlur(cmd) {
  const sel = sealSelector(cmd.target);
  return {
    playwright:  `await page.evaluate(() => document.querySelector('${sel}').blur());`,
    puppeteer:   `await page.$eval('${sel}', (el) => el.blur());`,
    fetch:       null,
    description: `Blur (unfocus) ${cmd.target}`,
  };
}

/**
 * Generate code snippets for a CLICK command.
 * @param {import('./index').ParsedCommand} cmd
 * @returns {ExecutionResult}
 */
function genClick(cmd) {
  const sel = sealSelector(cmd.target);
  return {
    playwright:  `await page.click('${sel}');`,
    puppeteer:   `await page.click('${sel}');`,
    fetch:       null,
    description: `Click ${cmd.target}`,
  };
}

/**
 * Generate code snippets for a HOVER command.
 * @param {import('./index').ParsedCommand} cmd
 * @returns {ExecutionResult}
 */
function genHover(cmd) {
  const sel = sealSelector(cmd.target);
  return {
    playwright:  `await page.hover('${sel}');`,
    puppeteer:   `await page.hover('${sel}');`,
    fetch:       null,
    description: `Hover over ${cmd.target}`,
  };
}

/**
 * Generate code snippets for a SELECT command.
 * @param {import('./index').ParsedCommand} cmd
 * @returns {ExecutionResult}
 */
function genSelect(cmd) {
  const sel = sealSelector(cmd.target);
  // SELECT BY index
  if (cmd.options && cmd.options.index !== undefined) {
    const idx = parseInt(cmd.options.index, 10);
    return {
      playwright:  `await page.selectOption('${sel}', { index: ${idx} });`,
      puppeteer:   `await page.$eval('${sel}', (el, i) => { el.selectedIndex = i; el.dispatchEvent(new Event('change', { bubbles: true })); }, ${idx});`,
      fetch:       null,
      description: `Select option at index ${idx} in ${cmd.target}`,
    };
  }
  // SELECT BY value / label
  const val = escStr(cmd.value);
  return {
    playwright:  `await page.selectOption('${sel}', { label: '${val}' });`,
    puppeteer:   `await page.select('${sel}', '${val}');`,
    fetch:       null,
    description: `Select '${cmd.value}' in ${cmd.target}`,
  };
}

/**
 * Generate code snippets for CHECK / UNCHECK / TOGGLE commands.
 * @param {import('./index').ParsedCommand} cmd
 * @returns {ExecutionResult}
 */
function genChecklike(cmd) {
  const sel = sealSelector(cmd.target);
  switch (cmd.command) {
    case 'CHECK':
      return {
        playwright:  `await page.check('${sel}');`,
        puppeteer:   `await page.$eval('${sel}', (el) => { if (!el.checked) el.click(); });`,
        fetch:       null,
        description: `Check ${cmd.target}`,
      };
    case 'UNCHECK':
      return {
        playwright:  `await page.uncheck('${sel}');`,
        puppeteer:   `await page.$eval('${sel}', (el) => { if (el.checked) el.click(); });`,
        fetch:       null,
        description: `Uncheck ${cmd.target}`,
      };
    case 'TOGGLE':
      return {
        playwright:  `await page.$eval('${sel}', (el) => el.click());`,
        puppeteer:   `await page.$eval('${sel}', (el) => el.click());`,
        fetch:       null,
        description: `Toggle ${cmd.target}`,
      };
    default:
      throw new Error(`Unexpected check-like command: ${cmd.command}`);
  }
}

/**
 * Generate code snippets for NAVIGATE commands.
 * @param {import('./index').ParsedCommand} cmd
 * @returns {ExecutionResult}
 */
function genNavigate(cmd) {
  if (cmd.value === 'back') {
    return {
      playwright:  `await page.goBack();`,
      puppeteer:   `await page.goBack();`,
      fetch:       null,
      description: `Navigate back`,
    };
  }
  if (cmd.value === 'forward') {
    return {
      playwright:  `await page.goForward();`,
      puppeteer:   `await page.goForward();`,
      fetch:       null,
      description: `Navigate forward`,
    };
  }
  const dest = escStr(cmd.value);
  return {
    playwright:  `await page.goto('${dest}');`,
    puppeteer:   `await page.goto('${dest}');`,
    fetch:       `const res = await fetch('${dest}');`,
    description: `Navigate to '${cmd.value}'`,
  };
}

/**
 * Generate code snippets for the RELOAD command.
 * @returns {ExecutionResult}
 */
function genReload() {
  return {
    playwright:  `await page.reload();`,
    puppeteer:   `await page.reload();`,
    fetch:       null,
    description: `Reload the current page`,
  };
}

/**
 * Generate code snippets for SCROLL commands.
 * @param {import('./index').ParsedCommand} cmd
 * @returns {ExecutionResult}
 */
function genScroll(cmd) {
  if (cmd.options && cmd.options.by) {
    const by = cmd.options.by;
    return {
      playwright:  `await page.evaluate(() => window.scrollBy(0, ${by}));`,
      puppeteer:   `await page.evaluate(() => window.scrollBy(0, ${by}));`,
      fetch:       null,
      description: `Scroll down by ${by}px`,
    };
  }
  if (cmd.value === 'top') {
    return {
      playwright:  `await page.evaluate(() => window.scrollTo(0, 0));`,
      puppeteer:   `await page.evaluate(() => window.scrollTo(0, 0));`,
      fetch:       null,
      description: `Scroll to top of page`,
    };
  }
  if (cmd.value === 'bottom') {
    return {
      playwright:  `await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));`,
      puppeteer:   `await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));`,
      fetch:       null,
      description: `Scroll to bottom of page`,
    };
  }
  // Scroll TO #selector
  const sel = sealSelector(cmd.target);
  return {
    playwright:  `await page.locator('${sel}').scrollIntoViewIfNeeded();`,
    puppeteer:   `await page.$eval('${sel}', (el) => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));`,
    fetch:       null,
    description: `Scroll to ${cmd.target}`,
  };
}

/**
 * Generate code snippets for SUBMIT / RESET / VALIDATE commands.
 * @param {import('./index').ParsedCommand} cmd
 * @returns {ExecutionResult}
 */
function genFormControl(cmd) {
  const sel = sealSelector(cmd.target);
  switch (cmd.command) {
    case 'SUBMIT':
      return {
        playwright:  `await page.$eval('${sel}', (form) => form.submit());`,
        puppeteer:   `await page.$eval('${sel}', (form) => form.submit());`,
        fetch:       null,
        description: `Submit form ${cmd.target}`,
      };
    case 'RESET':
      return {
        playwright:  `await page.$eval('${sel}', (form) => form.reset());`,
        puppeteer:   `await page.$eval('${sel}', (form) => form.reset());`,
        fetch:       null,
        description: `Reset form ${cmd.target}`,
      };
    case 'VALIDATE':
      return {
        playwright:  `await page.$eval('${sel}', (form) => form.reportValidity());`,
        puppeteer:   `await page.$eval('${sel}', (form) => form.reportValidity());`,
        fetch:       null,
        description: `Validate form ${cmd.target}`,
      };
    default:
      throw new Error(`Unexpected form-control command: ${cmd.command}`);
  }
}

/**
 * Generate code snippets for READ commands.
 * @param {import('./index').ParsedCommand} cmd
 * @returns {ExecutionResult}
 */
function genRead(cmd) {
  if (cmd.value === 'page') {
    return {
      playwright:  `const manifest = await page.evaluate(() => window.__sealManifest || JSON.parse(document.querySelector('script[type="application/seal+json"]')?.textContent || '{}'));`,
      puppeteer:   `const manifest = await page.evaluate(() => window.__sealManifest || JSON.parse(document.querySelector('script[type="application/seal+json"]')?.textContent || '{}'));`,
      fetch:       null,
      description: `Read full page AI manifest`,
    };
  }
  if (cmd.value === 'form') {
    const sel = sealSelector(cmd.target);
    return {
      playwright:  `const formData = await page.$eval('${sel}', (form) => Object.fromEntries(new FormData(form)));`,
      puppeteer:   `const formData = await page.$eval('${sel}', (form) => Object.fromEntries(new FormData(form)));`,
      fetch:       null,
      description: `Read form state of ${cmd.target}`,
    };
  }
  // READ #element
  const sel = sealSelector(cmd.target);
  return {
    playwright:  `const elData = await page.$eval('${sel}', (el) => ({ id: el.dataset.sealId, type: el.dataset.sealType, value: el.value ?? el.textContent, actions: el.dataset.sealActions?.split(',') }));`,
    puppeteer:   `const elData = await page.$eval('${sel}', (el) => ({ id: el.dataset.sealId, type: el.dataset.sealType, value: el.value ?? el.textContent, actions: el.dataset.sealActions?.split(',') }));`,
    fetch:       null,
    description: `Read element details for ${cmd.target}`,
  };
}

/**
 * Generate code snippets for LIST commands.
 * @param {import('./index').ParsedCommand} cmd
 * @returns {ExecutionResult}
 */
function genList(cmd) {
  const kind = cmd.value;
  const queries = {
    actions:  `document.querySelectorAll('[data-seal-actions]')`,
    inputs:   `document.querySelectorAll('[data-seal-type="Input"], [data-seal-type="Textarea"], [data-seal-type="Select"]')`,
    buttons:  `document.querySelectorAll('[data-seal-type="Button"]')`,
  };
  const jsQuery  = queries[kind] || queries.actions;
  const evalBody = `Array.from(${jsQuery}).map(el => ({ id: el.dataset.sealId, type: el.dataset.sealType, label: el.dataset.sealLabel, actions: el.dataset.sealActions?.split(',') }))`;
  return {
    playwright:  `const items = await page.evaluate(() => ${evalBody});`,
    puppeteer:   `const items = await page.evaluate(() => ${evalBody});`,
    fetch:       null,
    description: `List all ${kind} on the page`,
  };
}

/**
 * Generate code snippets for FIND commands.
 * @param {import('./index').ParsedCommand} cmd
 * @returns {ExecutionResult}
 */
function genFind(cmd) {
  const opts = cmd.options || {};
  const parts = Object.entries(opts).map(([k, v]) => `el.dataset.seal${k.charAt(0).toUpperCase() + k.slice(1)} === '${escStr(v)}'`);
  const filter = parts.length ? parts.join(' && ') : 'true';
  const evalBody = `Array.from(document.querySelectorAll('[data-seal-id]')).filter(el => ${filter}).map(el => ({ id: el.dataset.sealId, type: el.dataset.sealType, label: el.dataset.sealLabel, actions: el.dataset.sealActions?.split(',') }))`;
  return {
    playwright:  `const found = await page.evaluate(() => ${evalBody});`,
    puppeteer:   `const found = await page.evaluate(() => ${evalBody});`,
    fetch:       null,
    description: `Find elements matching ${JSON.stringify(opts)}`,
  };
}

/**
 * Generate code snippets for WAIT commands.
 * @param {import('./index').ParsedCommand} cmd
 * @returns {ExecutionResult}
 */
function genWait(cmd) {
  if (cmd.value === 'navigation') {
    return {
      playwright:  `await page.waitForNavigation();`,
      puppeteer:   `await page.waitForNavigation();`,
      fetch:       null,
      description: `Wait for page navigation to complete`,
    };
  }
  if (cmd.options && cmd.options.ms) {
    const ms = parseInt(cmd.options.ms, 10);
    return {
      playwright:  `await page.waitForTimeout(${ms});`,
      puppeteer:   `await new Promise(r => setTimeout(r, ${ms}));`,
      fetch:       null,
      description: `Wait for ${ms}ms`,
    };
  }
  if (cmd.options && cmd.options.condition) {
    const cond = escStr(cmd.options.condition);
    return {
      playwright:  `await page.waitForFunction('${cond}');`,
      puppeteer:   `await page.waitForFunction('${cond}');`,
      fetch:       null,
      description: `Wait until condition: ${cmd.options.condition}`,
    };
  }
  // WAIT FOR #selector
  const sel = sealSelector(cmd.target);
  return {
    playwright:  `await page.waitForSelector('${sel}');`,
    puppeteer:   `await page.waitForSelector('${sel}');`,
    fetch:       null,
    description: `Wait for element ${cmd.target} to appear`,
  };
}

/**
 * Generate code for a SEQUENCE block (flatten into sequential awaits).
 * @param {import('./index').ParsedCommand} cmd
 * @returns {ExecutionResult}
 */
function genSequence(cmd) {
  const lines = (cmd.body || []).map(sub => {
    const r = execute(sub);
    return `  ${r.playwright}`;
  });
  return {
    playwright:  `// Sequence: ${cmd.target}\n${lines.join('\n')}`,
    puppeteer:   `// Sequence: ${cmd.target}\n${lines.map(l => l.replace('playwright', 'puppeteer')).join('\n')}`,
    fetch:       null,
    description: `Execute sequence ${cmd.target} (${(cmd.body || []).length} steps)`,
  };
}

// ── Dispatch table ─────────────────────────────────────────────────────────────

/** @type {Object<string, function(import('./index').ParsedCommand): ExecutionResult>} */
const GENERATORS = {
  FILL:     genFill,
  CLEAR:    genClear,
  FOCUS:    genFocus,
  BLUR:     genBlur,
  CLICK:    genClick,
  HOVER:    genHover,
  SELECT:   genSelect,
  CHECK:    genChecklike,
  UNCHECK:  genChecklike,
  TOGGLE:   genChecklike,
  NAVIGATE: genNavigate,
  RELOAD:   (_cmd) => genReload(),
  SCROLL:   genScroll,
  SUBMIT:   genFormControl,
  RESET:    genFormControl,
  VALIDATE: genFormControl,
  READ:     genRead,
  LIST:     genList,
  FIND:     genFind,
  WAIT:     genWait,
  SEQUENCE: genSequence,
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Execute (or simulate) a single parsed SEAL command.
 *
 * Returns an {@link ExecutionResult} with generated Playwright, Puppeteer, and
 * optionally Fetch/API code snippets, plus a plain-English description.
 *
 * @param {import('./index').ParsedCommand} cmd - A command previously returned
 *   by {@link module:seal/ai-protocol.parseLine} or
 *   {@link module:seal/ai-protocol.parse}.
 * @returns {ExecutionResult}
 * @throws {Error} If the command token has no generator.
 *
 * @example
 * const { parseLine, execute } = require('./index');
 * const cmd = parseLine('FILL #email WITH "user@example.com"');
 * const result = execute(cmd);
 * // result.playwright → `await page.fill('[data-seal-id="email"]', 'user@example.com');`
 */
function execute(cmd) {
  const gen = GENERATORS[cmd.command];
  if (!gen) {
    throw new Error(`No executor for command: ${cmd.command}`);
  }
  const generated = gen(cmd);
  return {
    command:     cmd.command,
    target:      cmd.target   || null,
    value:       cmd.value    || null,
    options:     cmd.options  || {},
    playwright:  generated.playwright  || '',
    puppeteer:   generated.puppeteer   || '',
    fetch:       generated.fetch       || null,
    description: generated.description || '',
  };
}

/**
 * Execute an array of parsed SEAL commands in order and return all results.
 *
 * @param {import('./index').ParsedCommand[]} commands
 * @returns {ExecutionResult[]}
 */
function executeAll(commands) {
  return commands.map(execute);
}

module.exports = { execute, executeAll, sealSelector };

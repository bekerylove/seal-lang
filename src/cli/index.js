#!/usr/bin/env node
/**
 * @fileoverview SEAL CLI
 *
 * Node.js command-line interface for the SEAL toolchain.
 *
 * Usage:
 *   seal <command> [options]
 *
 * Commands:
 *   parse    <file>        Parse a .seal file and output AST as JSON
 *   render   <file>        Render a .seal file to HTML
 *   validate <file>        Validate a .seal file
 *   manifest <file>        Extract AI action manifest from a .seal file
 *   serve    <file>        Serve a .seal file as HTML on a local HTTP server
 *   exec     <file> <cmd>  Execute an AI command against a .seal page
 *   new      <name>        Create a new .seal file from a template
 *
 * Options:
 *   --output,  -o <file>   Output file path
 *   --pretty,  -p          Pretty-print JSON output
 *   --watch,   -w          Watch for file changes (parse/render/manifest)
 *   --port     <n>         Port for serve command (default: 3000)
 *   --template -t <id>     Template for `new` command (default: basic)
 *   --help,    -h          Show help
 *   --version, -v          Show version
 *
 * @module seal/cli
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const http = require('http');

// Lazily resolved seal module — avoids circular issues during early boot
let _seal = null;
function seal() {
  if (!_seal) _seal = require('../index');
  return _seal;
}

const { getTemplate, TEMPLATE_IDS } = require('./templates');

// ── Constants ─────────────────────────────────────────────────────────────────

const VERSION   = '0.1.0';
const DEF_PORT  = 3000;

// ── Argument parser ───────────────────────────────────────────────────────────

/**
 * @typedef {Object} ParsedArgs
 * @property {string}         command     - Sub-command (parse, render, …)
 * @property {string[]}       positional  - Non-flag positional arguments
 * @property {string|null}    output      - --output / -o value
 * @property {boolean}        pretty      - --pretty / -p flag
 * @property {boolean}        watch       - --watch / -w flag
 * @property {number}         port        - --port value
 * @property {string}         template    - --template / -t value
 * @property {boolean}        help        - --help / -h flag
 * @property {boolean}        version     - --version / -v flag
 */

/**
 * Parse process.argv into a structured args object.
 *
 * @param {string[]} argv - Raw argv (typically process.argv.slice(2))
 * @returns {ParsedArgs}
 */
function parseArgs(argv) {
  const args = {
    command:    null,
    positional: [],
    output:     null,
    pretty:     false,
    watch:      false,
    port:       DEF_PORT,
    template:   'basic',
    help:       false,
    version:    false,
  };

  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    if (a === '--output' || a === '-o') {
      args.output = argv[++i] || null;
    } else if (a === '--pretty' || a === '-p') {
      args.pretty = true;
    } else if (a === '--watch' || a === '-w') {
      args.watch = true;
    } else if (a === '--port') {
      args.port = parseInt(argv[++i], 10) || DEF_PORT;
    } else if (a === '--template' || a === '-t') {
      args.template = argv[++i] || 'basic';
    } else if (a === '--help' || a === '-h') {
      args.help = true;
    } else if (a === '--version' || a === '-v') {
      args.version = true;
    } else if (!a.startsWith('-')) {
      if (!args.command) {
        args.command = a;
      } else {
        args.positional.push(a);
      }
    }
    i++;
  }
  return args;
}

// ── Help text ─────────────────────────────────────────────────────────────────

const HELP_TEXT = `
SEAL CLI v${VERSION} — Semantic and Action Language toolchain

Usage:
  seal <command> [options]

Commands:
  parse    <file>           Parse a .seal file → AST JSON
  render   <file>           Render a .seal file → HTML
  validate <file>           Validate a .seal file and report errors
  manifest <file>           Extract AI action manifest → JSON
  serve    <file>           Serve a .seal file as HTML (dev server)
  exec     <file> <cmd…>    Execute an AI command string against a .seal page
  new      <name>           Create a new .seal file from a template

Options:
  --output, -o <file>       Write output to file instead of stdout
  --pretty, -p              Pretty-print JSON output (indent = 2)
  --watch,  -w              Watch for file changes and re-run automatically
  --port    <n>             Port for serve command (default: 3000)
  --template, -t <id>       Template for 'new' command
                            Available: ${TEMPLATE_IDS.join(', ')}
  --help,   -h              Show this help
  --version, -v             Show version

Examples:
  seal parse   login.seal --pretty
  seal render  login.seal -o login.html
  seal serve   login.seal --port 8080
  seal exec    login.seal "FILL #email WITH 'user@test.com'"
  seal new     my-app --template landing
`.trim();

// ── File helpers ──────────────────────────────────────────────────────────────

/**
 * Read a file as UTF-8.  Exits the process on error.
 * @param {string} filePath
 * @returns {string}
 */
function readFile(filePath) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    die(`File not found: ${filePath}`);
  }
  return fs.readFileSync(abs, 'utf8');
}

/**
 * Write content to a file or stdout.
 * @param {string|null} outputPath
 * @param {string}      content
 */
function writeOutput(outputPath, content) {
  if (outputPath) {
    const abs = path.resolve(outputPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
    log(`Written to ${abs}`);
  } else {
    process.stdout.write(content + '\n');
  }
}

/**
 * Stringify a value as JSON, optionally pretty-printed.
 * @param {*}       val
 * @param {boolean} pretty
 * @returns {string}
 */
function toJSON(val, pretty) {
  return pretty ? JSON.stringify(val, null, 2) : JSON.stringify(val);
}

// ── Logging helpers ───────────────────────────────────────────────────────────

/* eslint-disable no-console */
/** @param {string} msg */
function log(msg)  { console.error(`[seal] ${msg}`); }
/** @param {string} msg */
function warn(msg) { console.error(`[seal] WARN: ${msg}`); }
/** @param {string} msg @param {number} [code=1] */
function die(msg, code = 1)  { console.error(`[seal] ERROR: ${msg}`); process.exit(code); }
/* eslint-enable no-console */

// ── Dev-panel JS snippet ──────────────────────────────────────────────────────

/**
 * Generates the inline JS that renders the AI manifest floating panel.
 * Injected into served HTML pages in dev mode.
 *
 * @returns {string} A <script> tag string.
 */
function devPanelScript() {
  return `<script>
(function () {
  'use strict';
  var manifest = null;
  var scriptTag = document.querySelector('script[type="application/seal+json"]');
  if (scriptTag) {
    try { manifest = JSON.parse(scriptTag.textContent); } catch (e) {}
  }
  if (!manifest) return;

  var panel = document.createElement('div');
  panel.id  = 'seal-dev-panel';
  panel.style.cssText = [
    'position:fixed', 'bottom:16px', 'right:16px', 'z-index:99999',
    'background:#1e1e2e', 'color:#cdd6f4', 'font:13px/1.5 monospace',
    'border-radius:8px', 'box-shadow:0 4px 24px rgba(0,0,0,.5)',
    'max-width:380px', 'max-height:60vh', 'overflow-y:auto', 'padding:12px 16px',
  ].join(';');

  var header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:8px';
  var title  = document.createElement('strong');
  title.textContent  = '⚡ SEAL AI Manifest';
  var close  = document.createElement('button');
  close.textContent  = '✕';
  close.style.cssText = 'background:none;border:none;color:#cdd6f4;cursor:pointer;font-size:14px;padding:0 2px';
  close.onclick = function () { panel.remove(); };
  header.appendChild(title);
  header.appendChild(close);
  panel.appendChild(header);

  var pre = document.createElement('pre');
  pre.style.cssText = 'margin:0;white-space:pre-wrap;word-break:break-all;font-size:11px';
  pre.textContent = JSON.stringify(manifest, null, 2);
  panel.appendChild(pre);
  document.body.appendChild(panel);
})();
</script>`;
}

// ── WebSocket-based live-reload snippet ───────────────────────────────────────

/**
 * Tiny live-reload script injected by the dev server.
 * @param {number} port - The dev server port.
 * @returns {string}
 */
function liveReloadScript(port) {
  return `<script>
(function () {
  var es = new EventSource('http://localhost:${port}/__seal_reload');
  es.onmessage = function () { location.reload(); };
})();
</script>`;
}

// ── Command implementations ───────────────────────────────────────────────────

/**
 * `seal parse <file>` — parse a .seal file to AST JSON.
 * @param {string}     filePath
 * @param {ParsedArgs} args
 */
function cmdParse(filePath, args) {
  const src  = readFile(filePath);
  const ast  = seal().parse(src);
  writeOutput(args.output, toJSON(ast, args.pretty));
}

/**
 * `seal render <file>` — render a .seal file to HTML.
 * @param {string}     filePath
 * @param {ParsedArgs} args
 */
function cmdRender(filePath, args) {
  const src  = readFile(filePath);
  const html = seal().compile(src);
  writeOutput(args.output, html);
}

/**
 * `seal validate <file>` — validate a .seal file.
 * @param {string}     filePath
 * @param {ParsedArgs} args
 */
function cmdValidate(filePath, args) {
  const src    = readFile(filePath);
  const result = seal().validate(src);
  if (result.valid) {
    log('Valid SEAL file.');
    if (result.warnings && result.warnings.length > 0) {
      result.warnings.forEach((w) => warn(w));
    }
    writeOutput(args.output, toJSON(result, args.pretty));
    process.exit(0);
  } else {
    /* eslint-disable no-console */
    console.error(`[seal] Validation FAILED: ${result.errors.length} error(s)`);
    result.errors.forEach((e) => console.error(`  ✖ ${e}`));
    /* eslint-enable no-console */
    process.exit(1);
  }
}

/**
 * `seal manifest <file>` — extract AI manifest JSON.
 * @param {string}     filePath
 * @param {ParsedArgs} args
 */
function cmdManifest(filePath, args) {
  const src      = readFile(filePath);
  const ast      = seal().parse(src);
  const mf       = seal().manifest(ast);
  writeOutput(args.output, toJSON(mf, args.pretty));
}

/**
 * `seal exec <file> <cmd…>` — execute AI commands against a .seal page.
 * @param {string}     filePath
 * @param {string}     cmdString
 * @param {ParsedArgs} args
 */
function cmdExec(filePath, cmdString, args) {
  const src     = readFile(filePath);
  const ast     = seal().parse(src);
  const results = seal().execute(cmdString, ast);
  writeOutput(args.output, toJSON(results, args.pretty));
}

/**
 * `seal new <name>` — scaffold a new .seal file.
 * @param {string}     name
 * @param {ParsedArgs} args
 */
function cmdNew(name, args) {
  const templateId = args.template || 'basic';
  let   source;
  try {
    source = getTemplate(templateId, name);
  } catch (e) {
    die(e.message);
  }
  const filename  = args.output || `${name.toLowerCase().replace(/\s+/g, '-')}.seal`;
  const abs       = path.resolve(filename);
  if (fs.existsSync(abs)) {
    die(`File already exists: ${filename}  (use --output to specify a different path)`);
  }
  fs.writeFileSync(abs, source, 'utf8');
  log(`Created ${abs} (template: ${templateId})`);
}

/**
 * `seal serve <file>` — start a dev HTTP server with live-reload.
 * @param {string}     filePath
 * @param {ParsedArgs} args
 */
function cmdServe(filePath, args) {
  const port   = args.port || DEF_PORT;
  const absPath = path.resolve(filePath);

  // SSE clients waiting for reload signal
  const sseClients = [];

  /**
   * Build HTML with injected dev panel and live-reload snippet.
   * @returns {string}
   */
  function buildHTML() {
    const src  = fs.readFileSync(absPath, 'utf8');
    const ast  = seal().parse(src);
    const mf   = seal().manifest(ast);
    let   html = seal().render(ast);

    // Inject manifest as JSON script tag
    const manifestTag = `<script type="application/seal+json">${JSON.stringify(mf)}</script>`;

    // Inject before </body>
    html = html.replace(/<\/body>/i, `${manifestTag}\n${devPanelScript()}\n${liveReloadScript(port)}\n</body>`);

    return html;
  }

  const server = http.createServer((req, res) => {
    // SSE endpoint for live-reload
    if (req.url === '/__seal_reload') {
      res.writeHead(200, {
        'Content-Type':  'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection':    'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      res.write(': connected\n\n');
      sseClients.push(res);
      req.on('close', () => {
        const idx = sseClients.indexOf(res);
        if (idx !== -1) sseClients.splice(idx, 1);
      });
      return;
    }

    // Serve the rendered page for all other requests
    try {
      const html = buildHTML();
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`SEAL render error:\n${e.message}\n${e.stack}`);
    }
  });

  server.listen(port, () => {
    log(`Serving ${filePath} at http://localhost:${port}`);
    log('Press Ctrl+C to stop.');
  });

  // ── File watcher ─────────────────────────────────────────────────────────
  if (args.watch !== false) {
    let debounce = null;
    fs.watch(absPath, () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        log(`File changed: ${filePath} — reloading…`);
        sseClients.forEach((res) => {
          try { res.write('data: reload\n\n'); } catch (_) { /* client gone */ }
        });
      }, 100);
    });
  }
}

// ── Watch wrapper ─────────────────────────────────────────────────────────────

/**
 * Wrap a command function to re-run it when the source file changes.
 *
 * @param {string}         filePath - File to watch.
 * @param {function}       fn       - Zero-arg function to call immediately and on change.
 */
function withWatch(filePath, fn) {
  fn();
  const abs = path.resolve(filePath);
  let debounce = null;
  fs.watch(abs, () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      log(`File changed: ${filePath}`);
      try { fn(); } catch (e) { warn(e.message); }
    }, 100);
  });
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Main CLI entry point.
 * @param {string[]} argv - Raw process.argv
 */
function main(argv) {
  const args = parseArgs(argv.slice(2));

  if (args.version) {
    process.stdout.write(`seal v${VERSION}\n`);
    return;
  }

  if (args.help || !args.command) {
    process.stdout.write(HELP_TEXT + '\n');
    return;
  }

  const [pos0, ...rest] = args.positional;

  switch (args.command) {

    case 'parse': {
      if (!pos0) die('Usage: seal parse <file>');
      if (args.watch) {
        withWatch(pos0, () => cmdParse(pos0, args));
      } else {
        cmdParse(pos0, args);
      }
      break;
    }

    case 'render': {
      if (!pos0) die('Usage: seal render <file>');
      if (args.watch) {
        withWatch(pos0, () => cmdRender(pos0, args));
      } else {
        cmdRender(pos0, args);
      }
      break;
    }

    case 'validate': {
      if (!pos0) die('Usage: seal validate <file>');
      cmdValidate(pos0, args);
      break;
    }

    case 'manifest': {
      if (!pos0) die('Usage: seal manifest <file>');
      if (args.watch) {
        withWatch(pos0, () => cmdManifest(pos0, args));
      } else {
        cmdManifest(pos0, args);
      }
      break;
    }

    case 'serve': {
      if (!pos0) die('Usage: seal serve <file>');
      cmdServe(pos0, args);
      break;
    }

    case 'exec': {
      if (!pos0) die('Usage: seal exec <file> <command…>');
      const cmdStr = rest.length > 0 ? rest.join(' ') : null;
      if (!cmdStr) die('Usage: seal exec <file> <command>');
      cmdExec(pos0, cmdStr, args);
      break;
    }

    case 'new': {
      if (!pos0) die('Usage: seal new <name> [--template <id>]');
      cmdNew(pos0, args);
      break;
    }

    default:
      die(`Unknown command: "${args.command}"\nRun 'seal --help' for usage.`);
  }
}

// ── Run ───────────────────────────────────────────────────────────────────────

if (require.main === module) {
  main(process.argv);
}

module.exports = { main, parseArgs };

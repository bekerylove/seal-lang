/**
 * @fileoverview SEAL HTML Renderer
 *
 * Converts a SEAL AST produced by the parser into a fully self-contained HTML
 * page, an extracted CSS string, and a compact AI-readable page manifest.
 *
 * Usage:
 * ```js
 * const { render } = require('./src/renderer');
 * const { html, css, manifest } = render(ast);
 * ```
 *
 * @module seal/renderer
 */

'use strict';

const { serializeActions } = require('./action-map');
const { getBaseStyles }    = require('./styles');

// ─── Internal constants ────────────────────────────────────────────────────────

/**
 * Heading-level variant names mapped to their HTML tag.
 * @type {Record<string, string>}
 */
const HEADING_VARIANTS = {
  'heading-1': 'h1',
  'heading-2': 'h2',
  'heading-3': 'h3',
  'heading-4': 'h4',
  'heading-5': 'h5',
  'heading-6': 'h6',
};

/**
 * Icon name to emoji/character fallbacks.
 * Extended by callers via `renderOptions.iconMap`.
 * @type {Record<string, string>}
 */
const DEFAULT_ICON_MAP = {
  close:    '✕',
  check:    '✓',
  warning:  '⚠',
  info:     'ℹ',
  error:    '✗',
  search:   '🔍',
  user:     '👤',
  settings: '⚙',
  home:     '🏠',
  menu:     '☰',
  arrow:    '→',
  back:     '←',
  plus:     '+',
  minus:    '−',
  edit:     '✏',
  delete:   '🗑',
  star:     '★',
  heart:    '♥',
  mail:     '✉',
  lock:     '🔒',
  unlock:   '🔓',
  eye:      '👁',
  link:     '🔗',
  upload:   '⬆',
  download: '⬇',
  calendar: '📅',
  bell:     '🔔',
  cart:     '🛒',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Escapes a string for safe inclusion in HTML text content or attribute values.
 *
 * @param {unknown} value - Raw value to escape.
 * @returns {string} HTML-safe string.
 */
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

/**
 * Escapes a string for safe inclusion inside a CSS `url()` or `content` value.
 *
 * @param {string} value - Raw value.
 * @returns {string} CSS-safe string.
 */
function escapeCss(value) {
  return String(value).replace(/[<>"'\\]/g, c => '\\' + c.charCodeAt(0).toString(16) + ' ');
}

/**
 * Converts a camelCase or kebab-case string to a CSS property name.
 *
 * @param {string} str
 * @returns {string}
 */
function toCssProperty(str) {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}

/**
 * Serialises an object of style overrides into an inline `style` attribute
 * value.
 *
 * @param {Record<string, string|number>|null|undefined} styleObj
 * @returns {string} e.g. `"color: red; margin-top: 8px;"` — empty string when
 *   `styleObj` is falsy or empty.
 */
function serializeInlineStyle(styleObj) {
  if (!styleObj || typeof styleObj !== 'object') return '';
  const parts = [];
  for (const [prop, val] of Object.entries(styleObj)) {
    if (val !== null && val !== undefined && val !== '') {
      parts.push(`${toCssProperty(prop)}: ${escapeHtml(val)}`);
    }
  }
  return parts.join('; ');
}

/**
 * Builds the common `data-seal-*` attributes shared by every rendered element.
 *
 * @param {ASTNode} node - The AST node being rendered.
 * @returns {string} Partial HTML attribute string (leading space included).
 */
function sealDataAttrs(node) {
  const parts = [`data-seal-type="${escapeHtml(node.type)}"`];
  if (node.id)   parts.push(`data-seal-id="${escapeHtml(node.id)}"`);
  if (node.role) parts.push(`data-seal-role="${escapeHtml(node.role)}"`);
  parts.push(`data-seal-actions="${serializeActions(node.type)}"`);
  return ' ' + parts.join(' ');
}

/**
 * Builds standard HTML global attributes from an AST node: `id`, `class`,
 * `aria-*`, `role`, `style`, plus any pass-through `attrs`.
 *
 * @param {ASTNode}  node
 * @param {string[]} [extraClasses]
 * @returns {string} Partial HTML attribute string (leading space included).
 */
function globalAttrs(node, extraClasses = []) {
  const parts = [];

  // id
  if (node.id) parts.push(`id="${escapeHtml(node.id)}"`);

  // class
  const classes = [...extraClasses];
  if (node.attrs?.class) classes.push(escapeHtml(node.attrs.class));
  if (classes.length)    parts.push(`class="${classes.join(' ')}"`);

  // ARIA role
  if (node.role) parts.push(`role="${escapeHtml(node.role)}"`);

  // Pass-through attrs (skip class, it's handled above)
  if (node.attrs && typeof node.attrs === 'object') {
    for (const [k, v] of Object.entries(node.attrs)) {
      if (k === 'class') continue;
      parts.push(`${escapeHtml(k)}="${escapeHtml(v)}"`);
    }
  }

  // size / variant as data-* for CSS hooks
  if (node.variant) parts.push(`data-variant="${escapeHtml(node.variant)}"`);
  if (node.attrs?.size) parts.push(`data-size="${escapeHtml(node.attrs.size)}"`);

  // Inline style
  const inlineStyle = serializeInlineStyle(node.style);
  if (inlineStyle) parts.push(`style="${inlineStyle}"`);

  return parts.length ? ' ' + parts.join(' ') : '';
}

/**
 * Returns an indented string for the given depth level.
 *
 * @param {number} depth
 * @returns {string}
 */
function indent(depth) {
  return '  '.repeat(depth);
}

// ─── Manifest Collector ───────────────────────────────────────────────────────

/**
 * @typedef {object} ManifestAction
 * @property {string}   id      - Semantic ID of the element.
 * @property {string}   type    - SEAL element type.
 * @property {string[]} actions - Available action tokens.
 * @property {string}   [label] - Human-readable label, if available.
 */

/**
 * Recursively walks an AST and pushes interactable element entries into the
 * `items` array.
 *
 * @param {ASTNode}        node
 * @param {ManifestAction[]} items
 */
function collectManifestItems(node, items) {
  if (!node || typeof node !== 'object') return;

  const INTERACTABLE = new Set([
    'Input', 'Textarea', 'Select', 'Checkbox', 'Radio',
    'Button', 'Link', 'Form', 'Tab', 'NavItem', 'NavBrand',
    'Dialog', 'Alert', 'Toast', 'Tag',
    'Row', 'Cell', 'Table',
  ]);

  if (node.id && INTERACTABLE.has(node.type)) {
    /** @type {ManifestAction} */
    const entry = {
      id:      node.id,
      type:    node.type,
      actions: Array.from(serializeActions(node.type).split(',')),
    };
    if (node.text)             entry.label = node.text;
    if (node.attrs?.label)     entry.label = node.attrs.label;
    if (node.attrs?.placeholder) entry.placeholder = node.attrs.placeholder;
    if (node.attrs?.required || node.attrs?.['data-seal-required'])
      entry.required = true;
    items.push(entry);
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) collectManifestItems(child, items);
  }
}

// ─── Element Renderers ────────────────────────────────────────────────────────

/**
 * @typedef {object} ASTNode
 * @property {string}               type        - SEAL element type.
 * @property {string}               [id]        - Semantic identifier.
 * @property {string}               [role]      - ARIA role override.
 * @property {string}               [variant]   - Visual variant token.
 * @property {Record<string,string>}[attrs]     - Pass-through HTML attributes.
 * @property {string}               [text]      - Inline text content.
 * @property {ASTNode[]}            [children]  - Child nodes.
 * @property {object[]}             [directives]- Conditional / loop directives.
 * @property {Record<string,string>}[style]     - Inline style overrides.
 */

/**
 * @typedef {object} RenderOptions
 * @property {Record<string, string>} [iconMap] - Custom icon-name → glyph map.
 * @property {number}                 [depth]   - Current indent depth (internal).
 */

/**
 * Renders a single AST node and its subtree into an HTML string.
 *
 * @param {ASTNode}       node    - Node to render.
 * @param {RenderOptions} [opts]  - Rendering options.
 * @returns {string} HTML fragment.
 */
function renderNode(node, opts = {}) {
  if (!node || typeof node !== 'object') return '';

  const depth   = opts.depth  ?? 0;
  const iconMap = { ...DEFAULT_ICON_MAP, ...(opts.iconMap ?? {}) };
  const nl      = '\n';

  /**
   * Renders all children of a node, incrementing the depth.
   *
   * @param {ASTNode} parent
   * @returns {string}
   */
  function renderChildren(parent) {
    if (!Array.isArray(parent.children) || parent.children.length === 0) return '';
    return parent.children
      .map(child => renderNode(child, { ...opts, depth: depth + 1 }))
      .join(nl);
  }

  /**
   * Builds the textual body of an element: inline text first, then children.
   *
   * @param {ASTNode} n
   * @returns {string}
   */
  function body(n) {
    const text = n.text ? escapeHtml(n.text) : '';
    const kids = renderChildren(n);
    if (text && kids) return text + nl + kids;
    return text || kids;
  }

  /**
   * Wraps content in an open/close tag pair with data-seal-* attributes.
   *
   * @param {string}   tag
   * @param {string}   content
   * @param {string[]} [classes]
   * @param {string}   [extraAttrs]
   * @returns {string}
   */
  function wrap(tag, content, classes = [], extraAttrs = '') {
    const ga   = globalAttrs(node, classes);
    const seal = sealDataAttrs(node);
    const open = `${indent(depth)}<${tag}${ga}${seal}${extraAttrs}>`;
    const close = `</${tag}>`;
    if (!content) return `${open}${close}`;
    const hasBlock = content.includes('\n');
    return hasBlock
      ? `${open}${nl}${content}${nl}${indent(depth)}${close}`
      : `${open}${content}${close}`;
  }

  // ── Dispatch by type ────────────────────────────────────────────────────────

  switch (node.type) {

    // ── Page ────────────────────────────────────────────────────────────────
    case 'Page': {
      // Page is handled at the top level by render().
      // When encountered as a child (unusual), just render its body.
      return renderChildren(node);
    }

    // ── Semantic layout ─────────────────────────────────────────────────────
    case 'Section':  return wrap('section', body(node));
    case 'Main':     return wrap('main',    body(node));
    case 'Aside':    return wrap('aside',   body(node));
    case 'Header':   return wrap('header',  body(node));
    case 'Footer':   return wrap('footer',  body(node));
    case 'Article':  return wrap('article', body(node));

    // ── Card ─────────────────────────────────────────────────────────────────
    case 'Card':       return wrap('div', body(node), ['seal-card']);
    case 'CardHeader': return wrap('div', body(node), ['seal-card-header']);
    case 'CardBody':   return wrap('div', body(node), ['seal-card-body']);
    case 'CardFooter': return wrap('div', body(node), ['seal-card-footer']);

    // ── Form ─────────────────────────────────────────────────────────────────
    case 'Form': {
      const ga   = globalAttrs(node, []);
      const seal = sealDataAttrs(node);
      const open = `${indent(depth)}<form${ga}${seal}>`;
      const kids = renderChildren(node);
      const close = `${indent(depth)}</form>`;
      return `${open}${nl}${kids}${nl}${close}`;
    }

    // ── Input ─────────────────────────────────────────────────────────────────
    case 'Input': {
      const fieldId   = node.id ?? `field-${Math.random().toString(36).slice(2, 8)}`;
      const inputId   = `${fieldId}-input`;
      const labelText = node.attrs?.label ?? node.text ?? '';
      const required  = node.attrs?.required ? ' required' : '';
      const reqMark   = node.attrs?.required
        ? `<span class="seal-required" aria-hidden="true">*</span>` : '';
      const inputType = node.attrs?.type ?? 'text';
      const placeholder = node.attrs?.placeholder
        ? ` placeholder="${escapeHtml(node.attrs.placeholder)}"` : '';
      const value = node.attrs?.value
        ? ` value="${escapeHtml(node.attrs.value)}"` : '';
      const sizeAttr = node.attrs?.size ? ` data-size="${escapeHtml(node.attrs.size)}"` : '';
      const sealRequired = node.attrs?.required ? ' data-seal-required="true"' : '';
      const seal = sealDataAttrs(node);

      let html = `${indent(depth)}<div class="seal-field"${seal}>`;
      if (labelText) {
        html += `${nl}${indent(depth + 1)}<label for="${escapeHtml(inputId)}">${escapeHtml(labelText)}${reqMark}</label>`;
      }
      html += `${nl}${indent(depth + 1)}<input`;
      html += ` type="${escapeHtml(inputType)}"`;
      html += ` id="${escapeHtml(inputId)}"`;
      html += ` name="${escapeHtml(fieldId)}"`;
      html += placeholder + value + sizeAttr + sealRequired + required;
      html += ` />`;
      html += `${nl}${indent(depth)}</div>`;
      return html;
    }

    // ── Textarea ──────────────────────────────────────────────────────────────
    case 'Textarea': {
      const fieldId   = node.id ?? `field-${Math.random().toString(36).slice(2, 8)}`;
      const taId      = `${fieldId}-textarea`;
      const labelText = node.attrs?.label ?? node.text ?? '';
      const required  = node.attrs?.required ? ' required' : '';
      const reqMark   = node.attrs?.required
        ? `<span class="seal-required" aria-hidden="true">*</span>` : '';
      const placeholder = node.attrs?.placeholder
        ? ` placeholder="${escapeHtml(node.attrs.placeholder)}"` : '';
      const rows = node.attrs?.rows ? ` rows="${escapeHtml(node.attrs.rows)}"` : '';
      const seal = sealDataAttrs(node);

      let html = `${indent(depth)}<div class="seal-field"${seal}>`;
      if (labelText) {
        html += `${nl}${indent(depth + 1)}<label for="${escapeHtml(taId)}">${escapeHtml(labelText)}${reqMark}</label>`;
      }
      html += `${nl}${indent(depth + 1)}<textarea`;
      html += ` id="${escapeHtml(taId)}"`;
      html += ` name="${escapeHtml(fieldId)}"`;
      html += placeholder + rows + required;
      html += `>${escapeHtml(node.attrs?.value ?? '')}</textarea>`;
      html += `${nl}${indent(depth)}</div>`;
      return html;
    }

    // ── Select ────────────────────────────────────────────────────────────────
    case 'Select': {
      const fieldId   = node.id ?? `field-${Math.random().toString(36).slice(2, 8)}`;
      const selId     = `${fieldId}-select`;
      const labelText = node.attrs?.label ?? node.text ?? '';
      const required  = node.attrs?.required ? ' required' : '';
      const seal = sealDataAttrs(node);

      const optionNodes = (node.children ?? []).filter(c => c.type === 'Option');
      const optionsHtml = optionNodes.map(opt => {
        const val      = opt.attrs?.value ?? opt.text ?? '';
        const selected = opt.attrs?.selected ? ' selected' : '';
        return `${indent(depth + 2)}<option value="${escapeHtml(val)}"${selected}>${escapeHtml(opt.text ?? val)}</option>`;
      }).join(nl);

      let html = `${indent(depth)}<div class="seal-field"${seal}>`;
      if (labelText) {
        html += `${nl}${indent(depth + 1)}<label for="${escapeHtml(selId)}">${escapeHtml(labelText)}</label>`;
      }
      html += `${nl}${indent(depth + 1)}<select id="${escapeHtml(selId)}" name="${escapeHtml(fieldId)}"${required}>`;
      if (optionsHtml) html += `${nl}${optionsHtml}${nl}${indent(depth + 1)}`;
      html += `</select>`;
      html += `${nl}${indent(depth)}</div>`;
      return html;
    }

    // ── Checkbox ──────────────────────────────────────────────────────────────
    case 'Checkbox': {
      const cbId    = node.id ?? `cb-${Math.random().toString(36).slice(2, 8)}`;
      const checked = node.attrs?.checked ? ' checked' : '';
      const label   = node.text ?? node.attrs?.label ?? '';
      const seal    = sealDataAttrs(node);
      return [
        `${indent(depth)}<label class="seal-checkbox"${seal}>`,
        `${indent(depth + 1)}<input type="checkbox" id="${escapeHtml(cbId)}" name="${escapeHtml(cbId)}"${checked} />`,
        `${indent(depth + 1)}<span>${escapeHtml(label)}</span>`,
        `${indent(depth)}</label>`,
      ].join(nl);
    }

    // ── Radio ──────────────────────────────────────────────────────────────────
    case 'Radio': {
      const rId     = node.id ?? `radio-${Math.random().toString(36).slice(2, 8)}`;
      const checked = node.attrs?.checked ? ' checked' : '';
      const groupName = node.attrs?.name ?? rId;
      const label   = node.text ?? node.attrs?.label ?? '';
      const seal    = sealDataAttrs(node);
      return [
        `${indent(depth)}<label class="seal-radio"${seal}>`,
        `${indent(depth + 1)}<input type="radio" id="${escapeHtml(rId)}" name="${escapeHtml(groupName)}" value="${escapeHtml(node.attrs?.value ?? label)}"${checked} />`,
        `${indent(depth + 1)}<span>${escapeHtml(label)}</span>`,
        `${indent(depth)}</label>`,
      ].join(nl);
    }

    // ── Button ────────────────────────────────────────────────────────────────
    case 'Button': {
      const btnType = node.attrs?.type ?? 'button';
      const disabled = node.attrs?.disabled ? ' disabled' : '';
      return wrap('button', body(node), [], ` type="${escapeHtml(btnType)}"${disabled}`);
    }

    // ── Link ──────────────────────────────────────────────────────────────────
    case 'Link': {
      const href   = node.attrs?.href ?? node.attrs?.to ?? '#';
      const target = node.attrs?.target ? ` target="${escapeHtml(node.attrs.target)}"` : '';
      const rel    = node.attrs?.target === '_blank'
        ? ` rel="noopener noreferrer"` : '';
      return wrap('a', body(node), [], ` href="${escapeHtml(href)}"${target}${rel}`);
    }

    // ── Text ──────────────────────────────────────────────────────────────────
    case 'Text': {
      const variant = node.variant ?? node.attrs?.variant ?? 'body';
      if (HEADING_VARIANTS[variant]) {
        return wrap(HEADING_VARIANTS[variant], body(node));
      }
      if (variant === 'caption' || variant === 'label') {
        return wrap('span', body(node), [`seal-${variant}`]);
      }
      // body / default → <p>
      return wrap('p', body(node));
    }

    // ── Image ──────────────────────────────────────────────────────────────────
    case 'Image': {
      const src = node.attrs?.src ?? '';
      const alt = node.attrs?.alt ?? node.text ?? '';
      const ga   = globalAttrs(node, []);
      const seal = sealDataAttrs(node);
      return `${indent(depth)}<img${ga}${seal} src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" />`;
    }

    // ── Icon ───────────────────────────────────────────────────────────────────
    case 'Icon': {
      const name  = node.attrs?.name ?? node.text ?? '';
      const glyph = iconMap[name.toLowerCase()] ?? name;
      const aria  = name ? ` aria-label="${escapeHtml(name)}"` : ` aria-hidden="true"`;
      return wrap('span', escapeHtml(glyph), ['seal-icon'], aria);
    }

    // ── Badge ──────────────────────────────────────────────────────────────────
    case 'Badge': return wrap('span', body(node), ['seal-badge']);

    // ── Tag ────────────────────────────────────────────────────────────────────
    case 'Tag': return wrap('span', body(node), ['seal-tag']);

    // ── List ───────────────────────────────────────────────────────────────────
    case 'List': {
      const ordered = node.attrs?.ordered === 'true' || node.variant === 'ordered';
      const tag     = ordered ? 'ol' : 'ul';
      return wrap(tag, renderChildren(node), ['seal-list']);
    }

    // ── Item ───────────────────────────────────────────────────────────────────
    case 'Item': return wrap('li', body(node));

    // ── Table ─────────────────────────────────────────────────────────────────
    case 'Table': {
      const colsNode = (node.children ?? []).find(c => c.type === 'Columns');
      const rowsNode = (node.children ?? []).find(c => c.type === 'Rows');

      let theadHtml = '';
      if (colsNode) {
        const cols = (colsNode.children ?? []).filter(c => c.type === 'Column');
        const thHtml = cols.map(col =>
          `${indent(depth + 3)}<th${sealDataAttrs(col)}>${escapeHtml(col.text ?? col.attrs?.label ?? '')}</th>`
        ).join(nl);
        theadHtml = [
          `${indent(depth + 1)}<thead${sealDataAttrs(colsNode)}>`,
          `${indent(depth + 2)}<tr>`,
          thHtml,
          `${indent(depth + 2)}</tr>`,
          `${indent(depth + 1)}</thead>`,
        ].join(nl);
      }

      let tbodyHtml = '';
      if (rowsNode) {
        const rows = (rowsNode.children ?? []).filter(c => c.type === 'Row');
        const rowsHtml = rows.map(row => {
          const cells = (row.children ?? []).filter(c => c.type === 'Cell');
          const cellsHtml = cells.map(cell =>
            `${indent(depth + 4)}<td${sealDataAttrs(cell)}>${escapeHtml(cell.text ?? '')}</td>`
          ).join(nl);
          return [
            `${indent(depth + 3)}<tr${sealDataAttrs(row)}>`,
            cellsHtml,
            `${indent(depth + 3)}</tr>`,
          ].join(nl);
        }).join(nl);

        tbodyHtml = [
          `${indent(depth + 1)}<tbody${sealDataAttrs(rowsNode)}>`,
          rowsHtml,
          `${indent(depth + 1)}</tbody>`,
        ].join(nl);
      }

      const ga   = globalAttrs(node, []);
      const seal = sealDataAttrs(node);
      return [
        `${indent(depth)}<table${ga}${seal}>`,
        theadHtml,
        tbodyHtml,
        `${indent(depth)}</table>`,
      ].filter(Boolean).join(nl);
    }

    // Columns/Rows/Column/Row/Cell: handled inline by Table.
    // Render as fallback if encountered stand-alone.
    case 'Columns': return wrap('thead', renderChildren(node));
    case 'Rows':    return wrap('tbody', renderChildren(node));
    case 'Column':  return wrap('th',    body(node));
    case 'Row':     return wrap('tr',    renderChildren(node));
    case 'Cell':    return wrap('td',    body(node));

    // ── Flex / Grid ───────────────────────────────────────────────────────────
    case 'Flex': {
      const align   = node.attrs?.align   ? ` data-align="${escapeHtml(node.attrs.align)}"` : '';
      const justify = node.attrs?.justify ? ` data-justify="${escapeHtml(node.attrs.justify)}"` : '';
      const dir     = node.attrs?.direction ? ` data-direction="${escapeHtml(node.attrs.direction)}"` : '';
      return wrap('div', renderChildren(node), ['seal-flex'], `${align}${justify}${dir}`);
    }

    case 'Grid': {
      const cols = node.attrs?.cols ? ` data-cols="${escapeHtml(node.attrs.cols)}"` : '';
      return wrap('div', renderChildren(node), ['seal-grid'], cols);
    }

    // ── Divider & Spacer ──────────────────────────────────────────────────────
    case 'Divider': {
      const ga   = globalAttrs(node, ['seal-divider']);
      const seal = sealDataAttrs(node);
      return `${indent(depth)}<hr${ga}${seal} />`;
    }

    case 'Spacer': {
      const size = node.attrs?.size ? ` data-size="${escapeHtml(node.attrs.size)}"` : '';
      const ga   = globalAttrs(node, ['seal-spacer']);
      const seal = sealDataAttrs(node);
      return `${indent(depth)}<div${ga}${seal}${size}></div>`;
    }

    // ── Alert ──────────────────────────────────────────────────────────────────
    case 'Alert': return wrap('div', body(node), ['seal-alert']);

    // ── Toast ──────────────────────────────────────────────────────────────────
    case 'Toast': return wrap('div', body(node), ['seal-toast']);

    // ── Progress ──────────────────────────────────────────────────────────────
    case 'Progress': {
      const value = node.attrs?.value ?? '0';
      const max   = node.attrs?.max   ?? '100';
      const ga    = globalAttrs(node, []);
      const seal  = sealDataAttrs(node);
      return `${indent(depth)}<progress${ga}${seal} value="${escapeHtml(value)}" max="${escapeHtml(max)}">${escapeHtml(value)}%</progress>`;
    }

    // ── Spinner ────────────────────────────────────────────────────────────────
    case 'Spinner': {
      return wrap('div', `<span class="sr-only">Loading…</span>`, ['seal-spinner']);
    }

    // ── Dialog ─────────────────────────────────────────────────────────────────
    case 'Dialog': {
      const open = node.attrs?.open ? ' open' : '';
      return wrap('dialog', body(node), ['seal-dialog'], open);
    }

    // ── Tabs ───────────────────────────────────────────────────────────────────
    case 'Tabs': {
      const tabNodes = (node.children ?? []).filter(c => c.type === 'Tab');
      const tabListHtml = tabNodes.map(tab => {
        const active    = tab.attrs?.active ? ' class="seal-tab active" aria-selected="true"' : ' class="seal-tab"';
        const tabTarget = tab.attrs?.target ? ` data-target="${escapeHtml(tab.attrs.target)}"` : '';
        const seal      = sealDataAttrs(tab);
        const ga        = globalAttrs(tab, []);
        return `${indent(depth + 2)}<button${ga}${seal}${active}${tabTarget}>${escapeHtml(tab.text ?? '')}</button>`;
      }).join(nl);

      const ga   = globalAttrs(node, ['seal-tabs']);
      const seal = sealDataAttrs(node);
      return [
        `${indent(depth)}<div${ga}${seal}>`,
        `${indent(depth + 1)}<div class="seal-tabs-list" role="tablist">`,
        tabListHtml,
        `${indent(depth + 1)}</div>`,
        `${indent(depth)}</div>`,
      ].join(nl);
    }

    case 'Tab': return wrap('button', body(node), ['seal-tab']);

    // ── Nav ────────────────────────────────────────────────────────────────────
    case 'Nav': return wrap('nav', renderChildren(node), ['seal-nav']);

    // ── NavBrand ────────────────────────────────────────────────────────────────
    case 'NavBrand': {
      const href = node.attrs?.href ?? '/';
      return wrap('a', body(node), ['seal-nav-brand'], ` href="${escapeHtml(href)}"`);
    }

    // ── NavMenu ─────────────────────────────────────────────────────────────────
    case 'NavMenu': return wrap('ul', renderChildren(node), ['seal-nav-menu']);

    // ── NavItem ─────────────────────────────────────────────────────────────────
    case 'NavItem': {
      const href    = node.attrs?.href ?? node.attrs?.to ?? '#';
      const current = node.attrs?.active ? ' aria-current="page"' : '';
      const ga      = globalAttrs(node, []);
      const seal    = sealDataAttrs(node);
      return [
        `${indent(depth)}<li${ga}${seal}>`,
        `${indent(depth + 1)}<a href="${escapeHtml(href)}"${current}>${escapeHtml(node.text ?? '')}</a>`,
        `${indent(depth)}</li>`,
      ].join(nl);
    }

    // ── Breadcrumb ──────────────────────────────────────────────────────────────
    case 'Breadcrumb': {
      const ga   = globalAttrs(node, []);
      const seal = sealDataAttrs(node);
      const itemsHtml = (node.children ?? []).map(item => {
        const href    = item.attrs?.href ?? '#';
        const current = item.attrs?.current ? ' aria-current="page"' : '';
        if (item.attrs?.current) {
          return `${indent(depth + 2)}<li><span${current}>${escapeHtml(item.text ?? '')}</span></li>`;
        }
        return `${indent(depth + 2)}<li><a href="${escapeHtml(href)}">${escapeHtml(item.text ?? '')}</a></li>`;
      }).join(nl);
      return [
        `${indent(depth)}<nav aria-label="breadcrumb"${ga}${seal}>`,
        `${indent(depth + 1)}<ol>`,
        itemsHtml,
        `${indent(depth + 1)}</ol>`,
        `${indent(depth)}</nav>`,
      ].join(nl);
    }

    // ── Default / unknown ──────────────────────────────────────────────────────
    default: {
      // Render as a generic <div> with a data attribute for diagnostics.
      return wrap('div', body(node), [`seal-unknown`],
        ` data-seal-unknown-type="${escapeHtml(node.type)}"`);
    }
  }
}

// ─── Page Shell ───────────────────────────────────────────────────────────────

/**
 * Builds the `<head>` element for the page.
 *
 * @param {object} opts
 * @param {string} opts.title        - Page title.
 * @param {string} opts.description  - Meta description.
 * @param {string} opts.lang         - HTML lang attribute value.
 * @param {string} opts.css          - Inline CSS to embed.
 * @param {string} [opts.headExtra]  - Extra raw HTML for the `<head>`.
 * @returns {string}
 */
function buildHead({ title, description, lang, css, headExtra = '' }) {
  return `  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="${escapeHtml(description)}" />
    <title>${escapeHtml(title)}</title>
    <style>
${css}
    </style>${headExtra ? '\n    ' + headExtra : ''}
  </head>`;
}

/**
 * Wraps rendered body content in the full HTML5 document shell.
 *
 * @param {string} headHtml
 * @param {string} bodyHtml
 * @param {string} lang
 * @returns {string}
 */
function buildDocument(headHtml, bodyHtml, lang) {
  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
${headHtml}
  <body>
${bodyHtml}
  </body>
</html>`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * @typedef {object} RenderResult
 * @property {string}   html     - Full HTML document (`<!DOCTYPE html>…`).
 * @property {string}   css      - The base CSS string (also embedded in `html`).
 * @property {Manifest} manifest - AI-readable page manifest.
 */

/**
 * @typedef {object} Manifest
 * @property {string}          title   - Page title.
 * @property {string}          route   - Page route / URL path.
 * @property {string}          lang    - HTML language code.
 * @property {ManifestAction[]}actions - Interactable elements and their actions.
 */

/**
 * Renders a SEAL AST into a complete HTML page.
 *
 * @param {ASTNode}       ast              - Root AST node (typically `Page`).
 * @param {object}        [options]
 * @param {string}        [options.lang="en"]       - HTML `lang` attribute.
 * @param {string}        [options.headExtra=""]    - Raw HTML appended to `<head>`.
 * @param {Record<string,string>} [options.iconMap] - Custom icon-name → glyph overrides.
 * @returns {RenderResult}
 */
function render(ast, options = {}) {
  if (!ast || typeof ast !== 'object') {
    throw new TypeError('render(): ast must be a non-null object');
  }

  const lang        = options.lang      ?? ast.attrs?.lang ?? 'en';
  const headExtra   = options.headExtra ?? '';
  const iconMap     = options.iconMap   ?? {};

  // Resolve page metadata from the root node (or its attrs).
  const title       = ast.attrs?.title       ?? ast.text ?? 'Untitled Page';
  const description = ast.attrs?.description ?? '';
  const route       = ast.attrs?.route       ?? ast.attrs?.path ?? '/';

  // Generate CSS.
  const css = getBaseStyles();

  // Render the page body.
  let bodyHtml;
  if (ast.type === 'Page') {
    // Wrap all children in a .seal-page div; the Page node itself is not output.
    const pageAttrs    = globalAttrs(ast, ['seal-page']);
    const pageSealData = sealDataAttrs(ast);
    const children = (ast.children ?? [])
      .map(child => renderNode(child, { depth: 2, iconMap }))
      .join('\n');
    bodyHtml = `    <div${pageAttrs}${pageSealData}>\n${children}\n    </div>`;
  } else {
    // Non-Page root: render directly.
    bodyHtml = renderNode(ast, { depth: 2, iconMap });
  }

  // Build manifest.
  /** @type {ManifestAction[]} */
  const manifestItems = [];
  collectManifestItems(ast, manifestItems);

  /** @type {Manifest} */
  const manifest = {
    title,
    route,
    lang,
    actions: manifestItems,
  };

  // Assemble document.
  const headHtml = buildHead({ title, description, lang, css, headExtra });
  const html     = buildDocument(headHtml, bodyHtml, lang);

  return { html, css, manifest };
}

/**
 * Renders a partial SEAL AST fragment into an HTML string (no page shell).
 * Useful for rendering sub-trees, e.g. a single Card or Form.
 *
 * @param {ASTNode}       node    - The AST node to render.
 * @param {RenderOptions} [opts]  - Optional renderer options.
 * @returns {string} HTML fragment.
 */
function renderFragment(node, opts = {}) {
  return renderNode(node, { depth: 0, ...opts });
}

module.exports = { render, renderFragment, renderNode, escapeHtml };

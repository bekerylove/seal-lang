/**
 * @fileoverview SEAL AST Validator
 *
 * Walks a parsed SEAL AST and emits structured diagnostics (errors and
 * warnings) without throwing. The caller decides how to surface them.
 *
 * Validation rules enforced:
 *
 * ERRORS (severity: "error") — indicate structural or semantic problems
 * that would cause incorrect rendering or behaviour:
 *   - Document root must be a Page node.
 *   - Page must contain exactly one Body child.
 *   - Image elements must have a non-empty `src` attribute.
 *   - Link elements must have a non-empty `href` attribute.
 *   - Form `method` must be "GET" or "POST" when specified.
 *   - `[each]` directives must specify both a variable and a list.
 *   - Element children and inline text may not coexist on the same node.
 *
 * WARNINGS (severity: "warning") — indicate best-practice violations that
 * are unlikely to break rendering but may degrade accessibility or AI
 * agent usability:
 *   - Interactive elements (Input, Button, Checkbox, Select, etc.) should
 *     have an `#id`.
 *   - Form elements should have an `action` attribute.
 *   - Image elements should have a non-empty `alt` attribute.
 *   - Input elements of type "email" or "password" should be inside a Form.
 *   - Links that open in `_blank` should have `rel=noopener`.
 *   - Deeply nested layouts (> 8 levels) are flagged as a complexity warning.
 *
 * @module validator
 * @version 0.1.0
 */

'use strict';

// ─── Constants ─────────────────────────────────────────────────────────────────

/**
 * Elements that users directly interact with (they warrant an #id for the
 * AI action protocol).
 * @type {Set<string>}
 */
const INTERACTIVE_ELEMENTS = new Set([
  'Button',
  'Input',
  'Textarea',
  'Select',
  'Checkbox',
  'Radio',
  'Toggle',
  'Slider',
  'DatePicker',
  'FileUpload',
  'Link',
]);

/**
 * Valid form method values.
 * @type {Set<string>}
 */
const VALID_FORM_METHODS = new Set(['GET', 'POST', 'get', 'post']);

/**
 * Maximum recommended nesting depth before a complexity warning is emitted.
 * @type {number}
 */
const MAX_RECOMMENDED_DEPTH = 8;

// ─── Diagnostic ───────────────────────────────────────────────────────────────

/**
 * A single validation diagnostic message.
 *
 * @typedef {Object} Diagnostic
 * @property {"error"|"warning"|"info"} severity - Severity level.
 * @property {string}  code    - Machine-readable diagnostic code (e.g., "E001").
 * @property {string}  message - Human-readable description.
 * @property {number|null} line   - Source line number (null if unavailable).
 * @property {number|null} column - Source column number (null if unavailable).
 * @property {string|null} nodeType - The element type that triggered this.
 * @property {string|null} nodeId   - The element #id that triggered this.
 */

// ─── Validator ────────────────────────────────────────────────────────────────

/**
 * SEAL AST validator.
 *
 * Usage:
 * ```js
 * const validator = new Validator();
 * const { errors, warnings } = validator.validate(ast);
 * ```
 */
class Validator {
  constructor() {
    /** @type {Diagnostic[]} */
    this._diagnostics = [];
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Validate an AST and return all collected diagnostics split by severity.
   *
   * @param {Object} ast - Root AST node returned by the parser.
   * @returns {{ errors: Diagnostic[], warnings: Diagnostic[], infos: Diagnostic[] }}
   */
  validate(ast) {
    this._diagnostics = [];
    this._validateDocument(ast);
    this._walkNode(ast, 0, false);

    return {
      errors: this._diagnostics.filter(d => d.severity === 'error'),
      warnings: this._diagnostics.filter(d => d.severity === 'warning'),
      infos: this._diagnostics.filter(d => d.severity === 'info'),
    };
  }

  // ─── Document-Level Checks ─────────────────────────────────────────────────

  /**
   * Validate document-level constraints.
   *
   * @private
   * @param {Object} ast - Root AST node.
   */
  _validateDocument(ast) {
    // Root must be Page.
    if (!ast || ast.type !== 'Page') {
      this._emit('error', 'E001', 'Document root must be a Page element.', null, null, ast ? ast.type : null, null);
      return;
    }

    // Page must have a title attribute (or inline text, though title is more idiomatic).
    if (!ast.attrs.title) {
      this._emit('warning', 'W001', 'Page element should have a "title" attribute for the document title.', ast.line, ast.column, 'Page', ast.id);
    }

    // Page must contain a Body child.
    const bodyChildren = ast.children.filter(c => c.type === 'Body');
    if (bodyChildren.length === 0) {
      this._emit('error', 'E002', 'Page element must contain a Body child element.', ast.line, ast.column, 'Page', ast.id);
    } else if (bodyChildren.length > 1) {
      this._emit('error', 'E003', 'Page element must contain exactly one Body element; found multiple.', ast.line, ast.column, 'Page', ast.id);
    }
  }

  // ─── Recursive Node Walker ─────────────────────────────────────────────────

  /**
   * Recursively walk the AST, applying per-node validation rules.
   *
   * @private
   * @param {Object}  node          - Current AST node.
   * @param {number}  depth         - Current nesting depth.
   * @param {boolean} insideForm    - Whether we are inside a Form element.
   */
  _walkNode(node, depth, insideForm) {
    if (!node || typeof node !== 'object') return;

    // ── Depth check ─────────────────────────────────────────────────────────
    if (depth > MAX_RECOMMENDED_DEPTH) {
      this._emit(
        'warning',
        'W010',
        `Element nesting depth (${depth}) exceeds the recommended maximum of ${MAX_RECOMMENDED_DEPTH}. Consider flattening the structure.`,
        node.line, node.column, node.type, node.id
      );
    }

    // ── Inline text + children coexistence ──────────────────────────────────
    if (node.text !== null && node.children.length > 0) {
      this._emit(
        'error',
        'E010',
        `Element has both inline text and children. A node may have text content OR child elements, not both.`,
        node.line, node.column, node.type, node.id
      );
    }

    // ── Per-type validation ──────────────────────────────────────────────────
    switch (node.type) {
      case 'Image':
        this._validateImage(node);
        break;
      case 'Link':
        this._validateLink(node);
        break;
      case 'Form':
        this._validateForm(node);
        insideForm = true;
        break;
      case 'Input':
        this._validateInput(node, insideForm);
        break;
      case 'Select':
        this._validateSelect(node, insideForm);
        break;
      case 'Button':
        this._validateButton(node);
        break;
      case 'Table':
        this._validateTable(node);
        break;
      default:
        break;
    }

    // ── Interactive elements should have an #id ──────────────────────────────
    if (INTERACTIVE_ELEMENTS.has(node.type) && !node.id) {
      this._emit(
        'warning',
        'W020',
        `Interactive element <${node.type}> has no #id. AI agents use IDs to target actions; consider adding one.`,
        node.line, node.column, node.type, null
      );
    }

    // ── Validate directives ──────────────────────────────────────────────────
    this._validateDirectives(node);

    // ── Recurse into children ────────────────────────────────────────────────
    for (const child of node.children) {
      this._walkNode(child, depth + 1, insideForm);
    }
  }

  // ─── Element-Specific Validators ──────────────────────────────────────────

  /**
   * Validate an Image element.
   * @private
   * @param {Object} node
   */
  _validateImage(node) {
    if (!node.attrs.src) {
      this._emit(
        'error', 'E020',
        'Image element is missing the required "src" attribute.',
        node.line, node.column, 'Image', node.id
      );
    }
    if (!node.attrs.alt) {
      this._emit(
        'warning', 'W021',
        'Image element is missing an "alt" attribute. This degrades accessibility.',
        node.line, node.column, 'Image', node.id
      );
    } else if (typeof node.attrs.alt === 'string' && node.attrs.alt.trim() === '') {
      this._emit(
        'warning', 'W022',
        'Image "alt" attribute is empty. Use a descriptive value or omit for purely decorative images.',
        node.line, node.column, 'Image', node.id
      );
    }
  }

  /**
   * Validate a Link element.
   * @private
   * @param {Object} node
   */
  _validateLink(node) {
    if (!node.attrs.href) {
      this._emit(
        'error', 'E030',
        'Link element is missing the required "href" attribute.',
        node.line, node.column, 'Link', node.id
      );
    }

    // _blank links should have rel=noopener for security.
    if (node.attrs.target === '_blank') {
      const rel = node.attrs.rel || '';
      if (!rel.includes('noopener') && !rel.includes('noreferrer')) {
        this._emit(
          'warning', 'W031',
          'Link with target="_blank" should include rel="noopener noreferrer" to prevent security vulnerabilities.',
          node.line, node.column, 'Link', node.id
        );
      }
    }

    // Links without visible text or aria-label are inaccessible.
    if (!node.text && node.children.length === 0 && !node.attrs['aria-label']) {
      this._emit(
        'warning', 'W032',
        'Link has no visible text content or aria-label. Screen readers will not be able to describe it.',
        node.line, node.column, 'Link', node.id
      );
    }
  }

  /**
   * Validate a Form element.
   * @private
   * @param {Object} node
   */
  _validateForm(node) {
    if (!node.attrs.action) {
      this._emit(
        'warning', 'W040',
        'Form element has no "action" attribute. The submission endpoint is unknown to AI agents.',
        node.line, node.column, 'Form', node.id
      );
    }

    if (node.attrs.method && !VALID_FORM_METHODS.has(node.attrs.method)) {
      this._emit(
        'error', 'E040',
        `Form "method" must be "GET" or "POST"; found "${node.attrs.method}".`,
        node.line, node.column, 'Form', node.id
      );
    }

    // Warn if a Form contains no submit button.
    const hasSubmit = this._hasDescendant(node, n =>
      (n.type === 'Button' && (n.attrs.submit === true || n.attrs.type === 'submit')) ||
      (n.type === 'Input' && n.attrs.type === 'submit')
    );
    if (!hasSubmit) {
      this._emit(
        'warning', 'W041',
        'Form has no submit button. Add a Button with submit=true or type=submit.',
        node.line, node.column, 'Form', node.id
      );
    }
  }

  /**
   * Validate an Input element.
   * @private
   * @param {Object} node
   * @param {boolean} insideForm
   */
  _validateInput(node, insideForm) {
    const type = node.attrs.type || 'text';

    // Inputs of sensitive type should be inside a Form.
    if (!insideForm && ['email', 'password', 'number', 'tel'].includes(type)) {
      this._emit(
        'warning', 'W050',
        `Input[type=${type}] is not inside a Form element. AI agents expect form inputs to be wrapped in a Form.`,
        node.line, node.column, 'Input', node.id
      );
    }

    // Required inputs should have a label.
    if (node.attrs.required && !node.attrs.label && !node.attrs['aria-label']) {
      this._emit(
        'warning', 'W051',
        'Required Input has no "label" or "aria-label" attribute. Add a label for accessibility.',
        node.line, node.column, 'Input', node.id
      );
    }

    // Password inputs should never have autocomplete=on.
    if (type === 'password' && node.attrs.autocomplete === 'on') {
      this._emit(
        'warning', 'W052',
        'Password Input has autocomplete="on". Consider using autocomplete="current-password" or "new-password".',
        node.line, node.column, 'Input', node.id
      );
    }
  }

  /**
   * Validate a Select element.
   * @private
   * @param {Object} node
   * @param {boolean} insideForm
   */
  _validateSelect(node, insideForm) {
    if (!insideForm) {
      this._emit(
        'warning', 'W060',
        'Select element is not inside a Form element.',
        node.line, node.column, 'Select', node.id
      );
    }
    // Select should have at least one Option child.
    const hasOptions = node.children.some(c => c.type === 'Option');
    if (!hasOptions) {
      this._emit(
        'warning', 'W061',
        'Select element has no Option children.',
        node.line, node.column, 'Select', node.id
      );
    }
  }

  /**
   * Validate a Button element.
   * @private
   * @param {Object} node
   */
  _validateButton(node) {
    // Button with no text and no aria-label.
    if (!node.text && node.children.length === 0 && !node.attrs['aria-label']) {
      this._emit(
        'warning', 'W070',
        'Button has no text content or aria-label. It will not be actionable by AI agents or accessible to screen readers.',
        node.line, node.column, 'Button', node.id
      );
    }

    // Button with both href and submit=true is ambiguous.
    if (node.attrs.href && (node.attrs.submit === true || node.attrs.type === 'submit')) {
      this._emit(
        'warning', 'W071',
        'Button has both "href" and submit=true. Choose one: navigate (href) or submit (submit=true).',
        node.line, node.column, 'Button', node.id
      );
    }
  }

  /**
   * Validate a Table element (accessibility structure check).
   * @private
   * @param {Object} node
   */
  _validateTable(node) {
    // Tables should have at least one header row.
    const hasHeader = this._hasDescendant(node, n => n.type === 'TableHead');
    if (!hasHeader) {
      this._emit(
        'warning', 'W080',
        'Table has no TableHead cells. Add header cells for accessibility and AI data interpretation.',
        node.line, node.column, 'Table', node.id
      );
    }
  }

  // ─── Directive Validation ──────────────────────────────────────────────────

  /**
   * Validate the directives on a node.
   * @private
   * @param {Object} node
   */
  _validateDirectives(node) {
    for (const directive of node.directives) {
      if (directive.kind === 'each') {
        if (!directive.variable) {
          this._emit(
            'error', 'E050',
            '[each] directive is missing the loop variable name. Use: [each item in $list]',
            node.line, node.column, node.type, node.id
          );
        }
        if (!directive.list) {
          this._emit(
            'error', 'E051',
            '[each] directive is missing the list reference. Use: [each item in $list]',
            node.line, node.column, node.type, node.id
          );
        }
      }
      if ((directive.kind === 'if' || directive.kind === 'unless') && !directive.expr) {
        this._emit(
          'error', 'E052',
          `[${directive.kind}] directive is missing an expression. Use: [${directive.kind} $condition]`,
          node.line, node.column, node.type, node.id
        );
      }
    }
  }

  // ─── Utilities ─────────────────────────────────────────────────────────────

  /**
   * Recursively check whether any descendant of a node satisfies a predicate.
   *
   * @private
   * @param {Object}   node      - Root of the subtree to search.
   * @param {Function} predicate - Returns true for a matching node.
   * @returns {boolean}
   */
  _hasDescendant(node, predicate) {
    for (const child of node.children) {
      if (predicate(child)) return true;
      if (this._hasDescendant(child, predicate)) return true;
    }
    return false;
  }

  /**
   * Emit a diagnostic.
   *
   * @private
   * @param {"error"|"warning"|"info"} severity
   * @param {string} code
   * @param {string} message
   * @param {number|null} line
   * @param {number|null} column
   * @param {string|null} nodeType
   * @param {string|null} nodeId
   */
  _emit(severity, code, message, line, column, nodeType, nodeId) {
    this._diagnostics.push({
      severity,
      code,
      message,
      line: line || null,
      column: column || null,
      nodeType: nodeType || null,
      nodeId: nodeId || null,
    });
  }
}

// ─── Convenience validate() function ─────────────────────────────────────────

/**
 * Validate a SEAL AST and return diagnostics.
 *
 * @param {Object} ast - Root AST node.
 * @returns {{ errors: Diagnostic[], warnings: Diagnostic[], infos: Diagnostic[] }}
 *
 * @example
 * const { parse } = require('./src/parser');
 * const { validate } = require('./src/parser/validator');
 * const ast = parse(source);
 * const { errors, warnings } = validate(ast);
 * if (errors.length > 0) {
 *   errors.forEach(e => console.error(`[${e.code}] ${e.message}`));
 * }
 */
function validate(ast) {
  const validator = new Validator();
  return validator.validate(ast);
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = { Validator, validate };

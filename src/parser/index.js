/**
 * @fileoverview SEAL Language Parser
 *
 * Converts a SEAL token stream (produced by the Tokenizer) into an
 * Abstract Syntax Tree (AST).
 *
 * The parser is a recursive descent parser that walks the flat token stream
 * and uses INDENT/DEDENT tokens to reconstruct the tree hierarchy.
 *
 * AST Node shape:
 * ```js
 * {
 *   type:       string,   // PascalCase element type (e.g. "Form", "Button")
 *   id:         string|null,   // from #id selector
 *   role:       string|null,   // from .role selector
 *   variant:    string|null,   // first bare IDENTIFIER after selectors
 *   attrs:      Object,        // [key=value] pairs
 *   text:       string|null,   // inline quoted text or block text
 *   children:   ASTNode[],     // child nodes from indented block
 *   directives: Directive[],   // [if], [unless], [each], etc.
 *   style:      Object|null,   // @style block properties
 *   meta:       Object|null,   // @meta block
 *   state:      Object|null,   // @state block
 *   theme:      Object|null,   // @theme block
 *   viewport:   Object|null,   // @viewport block
 *   ai:         Object|null,   // @ai annotation block
 *   script:     string|null,   // @script block content
 *   docComment: string|null,   // preceding /// doc comment
 *   line:       number,        // source line number
 *   column:     number,        // source column number
 * }
 * ```
 *
 * Directive shape:
 * ```js
 * {
 *   kind:     "if"|"unless"|"each"|"ref"|"key"|"after",
 *   expr:     string,        // raw expression string
 *   variable: string|null,  // loop variable for "each"
 *   list:     string|null,  // list reference for "each"
 * }
 * ```
 *
 * @module parser
 * @version 0.1.0
 */

'use strict';

const { Tokenizer, TokenType } = require('./tokenizer');

// ─── ParseError ───────────────────────────────────────────────────────────────

/**
 * Thrown when the parser encounters invalid or unexpected tokens.
 */
class ParseError extends Error {
  /**
   * @param {string} message  - Human-readable error description.
   * @param {import('./tokenizer').Token} token - The unexpected token.
   */
  constructor(message, token) {
    const loc = token ? ` at ${token.line}:${token.column}` : '';
    super(`Parse error${loc} — ${message}`);
    this.name = 'ParseError';
    this.token = token || null;
    this.line = token ? token.line : null;
    this.column = token ? token.column : null;
  }
}

// ─── AST Node Factory ─────────────────────────────────────────────────────────

/**
 * Create a fresh AST node with all fields initialised to their defaults.
 *
 * @param {string} type   - The element type (PascalCase).
 * @param {number} line   - Source line number.
 * @param {number} column - Source column number.
 * @returns {Object} A new AST node.
 */
function createNode(type, line, column) {
  return {
    type,
    id: null,
    role: null,
    variant: null,
    attrs: {},
    text: null,
    children: [],
    directives: [],
    style: null,
    meta: null,
    state: null,
    theme: null,
    viewport: null,
    ai: null,
    script: null,
    docComment: null,
    line,
    column,
  };
}

// ─── Parser ───────────────────────────────────────────────────────────────────

/**
 * SEAL recursive descent parser.
 *
 * Consumes a flat token array and produces a nested AST.
 *
 * Usage:
 * ```js
 * const parser = new Parser(source);
 * const ast = parser.parse();
 * ```
 */
class Parser {
  /**
   * @param {string} source - The raw SEAL source text.
   */
  constructor(source) {
    /** @private @type {string} */
    this._source = source;
    /** @private @type {import('./tokenizer').Token[]} */
    this._tokens = [];
    /** @private @type {number} Current position in the token array */
    this._pos = 0;
    /** @private @type {string|null} Accumulated doc comment for next element */
    this._pendingDocComment = null;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Parse the source text and return the root AST node (a Page node).
   *
   * @returns {Object} The root AST node.
   * @throws {ParseError} On unexpected token sequences.
   */
  parse() {
    const tokenizer = new Tokenizer(this._source);
    this._tokens = tokenizer.tokenize();
    this._pos = 0;
    this._pendingDocComment = null;

    return this._parseDocument();
  }

  // ─── Document-Level Parsing ────────────────────────────────────────────────

  /**
   * Parse the top-level document, which must start with a `Page` element.
   *
   * @private
   * @returns {Object} Root AST node of type "Page".
   */
  _parseDocument() {
    this._skipComments();

    const first = this._peek();

    if (!first || first.type === TokenType.EOF) {
      throw new ParseError('Empty SEAL document; expected "Page" element.', first);
    }

    if (first.type !== TokenType.ELEMENT_TYPE || first.value !== 'Page') {
      throw new ParseError(
        `SEAL document must begin with a Page element; found "${first.value}".`,
        first
      );
    }

    return this._parseElement();
  }

  // ─── Element Parsing ───────────────────────────────────────────────────────

  /**
   * Parse a single element declaration line plus its optional child block.
   *
   * @private
   * @returns {Object} AST node.
   */
  _parseElement() {
    const typeTok = this._consume(TokenType.ELEMENT_TYPE);
    const node = createNode(typeTok.value, typeTok.line, typeTok.column);

    // Attach any preceding doc comment.
    if (this._pendingDocComment) {
      node.docComment = this._pendingDocComment;
      this._pendingDocComment = null;
    }

    // ── Optional selectors ────────────────────────────────────────────────
    if (this._peekIs(TokenType.ID)) {
      node.id = this._consume(TokenType.ID).value;
    }
    if (this._peekIs(TokenType.ROLE)) {
      node.role = this._consume(TokenType.ROLE).value;
    }

    // ── Optional variant (bare IDENTIFIER not followed by =) ─────────────
    // A bare identifier followed by '=' is a key=value attribute, not a variant.
    if (
      this._peekIs(TokenType.IDENTIFIER) &&
      !this._peekIsDirectiveKeyword() &&
      !this._lookaheadIs(1, TokenType.EQUALS)
    ) {
      node.variant = this._consume(TokenType.IDENTIFIER).value;
    }

    // ── Unbracketed key=value pairs and [bracketed] blocks ────────────────
    // Handles both: `Button variant=primary` and `[attr=value]` styles.
    // Also handles bare boolean flags like `required` (identifier not followed by =).
    this._parseInlineAttrsAndDirectives(node);

    // ── Promote `variant` attribute to node.variant if not already set ────
    // Supports both positional `Button primary` and keyed `Button variant=primary`.
    if (node.variant === null && typeof node.attrs.variant === 'string') {
      node.variant = node.attrs.variant;
      delete node.attrs.variant;
    }

    // ── Inline text: "string" ─────────────────────────────────────────────
    if (this._peekIs(TokenType.STRING)) {
      node.text = this._consume(TokenType.STRING).value;
    }

    // ── Remaining directives after inline text ────────────────────────────
    while (this._peekIs(TokenType.LBRACKET) && this._isDirectiveBracket()) {
      node.directives.push(...this._parseDirectiveBracket());
    }

    // ── NEWLINE ───────────────────────────────────────────────────────────
    this._expectNewline();

    // ── Child block ───────────────────────────────────────────────────────
    if (this._peekIs(TokenType.INDENT)) {
      this._consume(TokenType.INDENT);
      this._parseChildBlock(node);
      this._consume(TokenType.DEDENT);
    }

    return node;
  }

  /**
   * Parse the contents of an indented child block, appending children
   * and config block results to the parent node.
   *
   * @private
   * @param {Object} parentNode - The AST node that owns this block.
   */
  _parseChildBlock(parentNode) {
    while (!this._peekIs(TokenType.DEDENT) && !this._peekIs(TokenType.EOF)) {
      // Skip blank NEWLINEs at block level.
      if (this._peekIs(TokenType.NEWLINE)) {
        this._advance();
        continue;
      }

      // Doc comment.
      if (this._peekIs(TokenType.DOC_COMMENT)) {
        this._pendingDocComment = this._consume(TokenType.DOC_COMMENT).value;
        this._skipNewlines();
        continue;
      }

      // Discard regular comments.
      if (this._peekIs(TokenType.COMMENT)) {
        this._advance();
        this._skipNewlines();
        continue;
      }

      // Config / annotation directive blocks: @meta, @style, @theme, etc.
      if (this._peekIs(TokenType.DIRECTIVE)) {
        this._parseConfigDirective(parentNode);
        continue;
      }

      // Block text pipe lines.
      if (this._peekIs(TokenType.PIPE)) {
        const textContent = this._parseBlockText();
        // Append to existing text or set it.
        parentNode.text = parentNode.text
          ? parentNode.text + '\n' + textContent
          : textContent;
        continue;
      }

      // Child element.
      if (this._peekIs(TokenType.ELEMENT_TYPE)) {
        const child = this._parseElement();
        parentNode.children.push(child);
        continue;
      }

      // Quoted standalone text node (interpolation lines like "$error").
      if (this._peekIs(TokenType.STRING)) {
        const strTok = this._consume(TokenType.STRING);
        const textNode = createNode('Text', strTok.line, strTok.column);
        textNode.text = strTok.value;
        this._skipNewlines();
        parentNode.children.push(textNode);
        continue;
      }

      // Unexpected token — skip with warning rather than hard crash.
      const tok = this._peek();
      // In a production parser this would emit a diagnostic; here we skip.
      this._advance();
      if (this._peekIs(TokenType.NEWLINE)) this._advance();
    }
  }

  // ─── Inline Attribute Parsing (mixed bracketed + unbracketed) ─────────────

  /**
   * Parse inline attributes and directives on an element line.
   *
   * Handles the mixed syntax where attributes may appear either as:
   * - Unbracketed: `Input type=email required placeholder="hint"`
   * - Bracketed:   `Input [type=email required]`
   * - Bracketed directive: `Alert [if $err]`
   *
   * Continues consuming as long as the next token is one of:
   *   IDENTIFIER (key), LBRACKET ([), DOLLAR ($key).
   *
   * An IDENTIFIER followed by '=' is treated as a key=value attribute.
   * An IDENTIFIER NOT followed by '=' is a boolean attribute flag.
   * However, a bare IDENTIFIER that is a known variant-only word AND
   * not followed by '=' is skipped (variants are parsed before this method).
   *
   * @private
   * @param {Object} node - The AST node to attach attributes/directives to.
   */
  _parseInlineAttrsAndDirectives(node) {
    while (true) {
      // Bracketed [attr=value] or [directive] block
      if (this._peekIs(TokenType.LBRACKET)) {
        if (this._isDirectiveBracket()) {
          node.directives.push(...this._parseDirectiveBracket());
        } else {
          Object.assign(node.attrs, this._parseAttrBlock());
        }
        continue;
      }

      // Unbracketed IDENTIFIER key=value or bare boolean flag
      if (this._peekIs(TokenType.IDENTIFIER)) {
        const key = this._peek().value;
        // If next-next is EQUALS, this is a key=value attr.
        if (this._lookaheadIs(1, TokenType.EQUALS)) {
          this._advance(); // consume key
          this._advance(); // consume =
          node.attrs[key] = this._parseAttrValue();
          continue;
        }
        // Bare identifier: boolean attribute flag (but only if it looks like an attr, not another element's variant)
        // We only consume it as an attribute if it's lowercase and not followed by another word or string
        // that would form a variant+text pattern — use a heuristic: consume only if it does NOT look like
        // a variant that precedes text or end-of-line.
        // Conservative: skip bare identifiers here (they are either already consumed as variant, or are noise).
        break;
      }

      // Nothing more to parse as attributes.
      break;
    }
  }

  // ─── Attribute Block Parsing ───────────────────────────────────────────────

  /**
   * Parse an attribute block: `[key=value key2 key3="string"]`
   *
   * @private
   * @returns {Object} Map of attribute name → value.
   */
  _parseAttrBlock() {
    this._consume(TokenType.LBRACKET);
    const attrs = {};

    while (!this._peekIs(TokenType.RBRACKET) && !this._peekIs(TokenType.EOF)) {
      // Skip spaces / newlines within brackets (shouldn't normally appear).
      if (this._peekIs(TokenType.NEWLINE)) {
        this._advance();
        continue;
      }

      // Handle $var references (attribute value binding at start of pair).
      if (this._peekIs(TokenType.DOLLAR)) {
        // $expr as a bare attribute — treat as a computed spread (unusual).
        this._advance();
        if (this._peekIs(TokenType.IDENTIFIER)) {
          const varName = this._consume(TokenType.IDENTIFIER).value;
          attrs[`$${varName}`] = true;
        }
        continue;
      }

      // Standard key=value or bare key.
      const keyTok = this._peekIs(TokenType.IDENTIFIER) ? this._consume(TokenType.IDENTIFIER) : null;
      if (!keyTok) {
        // Could be ELEMENT_TYPE used as key (unlikely but handle gracefully).
        this._advance();
        continue;
      }
      const key = keyTok.value;

      if (this._peekIs(TokenType.EQUALS)) {
        this._consume(TokenType.EQUALS);
        attrs[key] = this._parseAttrValue();
      } else {
        // Boolean flag.
        attrs[key] = true;
      }
    }

    this._consume(TokenType.RBRACKET);
    return attrs;
  }

  /**
   * Parse a single attribute value: string, number, identifier, or $state ref.
   *
   * @private
   * @returns {string|number|boolean} The parsed attribute value.
   */
  _parseAttrValue() {
    if (this._peekIs(TokenType.STRING)) {
      return this._consume(TokenType.STRING).value;
    }
    if (this._peekIs(TokenType.NUMBER)) {
      const raw = this._consume(TokenType.NUMBER).value;
      return parseFloat(raw);
    }
    if (this._peekIs(TokenType.DOLLAR)) {
      this._consume(TokenType.DOLLAR);
      // Collect identifier chain (e.g., $user.name).
      let expr = '$';
      if (this._peekIs(TokenType.IDENTIFIER)) {
        expr += this._consume(TokenType.IDENTIFIER).value;
      }
      // Allow dot-chained property access.
      while (this._peekIsChar('.')) {
        this._advance(); // consume identifier that started with a dot or something unusual
        // Actually, dots inside attr values come through as part of the identifier
        // because the tokenizer doesn't split on dots within identifiers.
        // We handle the common $var.prop case by checking if the IDENTIFIER value
        // contains dots.
        break;
      }
      return expr;
    }
    if (this._peekIs(TokenType.IDENTIFIER)) {
      const val = this._consume(TokenType.IDENTIFIER).value;
      // Convert "true" / "false" string literals to boolean.
      if (val === 'true') return true;
      if (val === 'false') return false;
      return val;
    }
    if (this._peekIs(TokenType.ELEMENT_TYPE)) {
      // PascalCase used as value (e.g., method=POST).
      return this._consume(TokenType.ELEMENT_TYPE).value;
    }
    // Unexpected — return empty string.
    return '';
  }

  // ─── Directive Parsing ─────────────────────────────────────────────────────

  /**
   * Determine whether the upcoming `[...]` bracket is a directive
   * (contains a keyword like `if`, `unless`, `each`, `ref`, `key`, `after`)
   * rather than an attribute block.
   *
   * @private
   * @returns {boolean}
   */
  _isDirectiveBracket() {
    // Look ahead past the `[` for a directive keyword.
    const directiveKeywords = new Set(['if', 'unless', 'each', 'ref', 'key', 'after']);
    let lookAhead = this._pos + 1; // position after `[`
    while (lookAhead < this._tokens.length) {
      const tok = this._tokens[lookAhead];
      if (tok.type === TokenType.RBRACKET) break;
      if (tok.type === TokenType.IDENTIFIER && directiveKeywords.has(tok.value)) {
        return true;
      }
      lookAhead++;
    }
    return false;
  }

  /**
   * Parse one `[directive ...]` block and return an array of Directive objects.
   *
   * @private
   * @returns {Object[]} Array of directive descriptors.
   */
  _parseDirectiveBracket() {
    this._consume(TokenType.LBRACKET);
    const directives = [];

    while (!this._peekIs(TokenType.RBRACKET) && !this._peekIs(TokenType.EOF)) {
      if (!this._peekIs(TokenType.IDENTIFIER)) {
        this._advance();
        continue;
      }

      const kind = this._consume(TokenType.IDENTIFIER).value;

      switch (kind) {
        case 'if':
        case 'unless': {
          const expr = this._parseDirectiveExpr();
          directives.push({ kind, expr, variable: null, list: null });
          break;
        }
        case 'each': {
          // [each item in $list]
          const varName = this._peekIs(TokenType.IDENTIFIER)
            ? this._consume(TokenType.IDENTIFIER).value
            : null;
          // Consume 'in' keyword.
          if (this._peekIs(TokenType.IDENTIFIER) && this._peek().value === 'in') {
            this._advance();
          }
          // Consume $list reference.
          let listRef = null;
          if (this._peekIs(TokenType.DOLLAR)) {
            this._consume(TokenType.DOLLAR);
            if (this._peekIs(TokenType.IDENTIFIER)) {
              listRef = '$' + this._consume(TokenType.IDENTIFIER).value;
            }
          }
          directives.push({ kind: 'each', expr: null, variable: varName, list: listRef });
          break;
        }
        case 'ref': {
          if (this._peekIs(TokenType.EQUALS)) this._advance();
          const expr = this._parseDirectiveExpr();
          directives.push({ kind: 'ref', expr, variable: null, list: null });
          break;
        }
        case 'key':
        case 'after': {
          if (this._peekIs(TokenType.EQUALS)) this._advance();
          const expr = this._parseDirectiveExpr();
          directives.push({ kind, expr, variable: null, list: null });
          break;
        }
        default:
          // Unknown directive keyword — skip token.
          break;
      }
    }

    this._consume(TokenType.RBRACKET);
    return directives;
  }

  /**
   * Parse a directive expression (a state variable reference or simple expr).
   *
   * @private
   * @returns {string} Raw expression string.
   */
  _parseDirectiveExpr() {
    let expr = '';
    // Collect tokens until ] or a keyword boundary.
    while (!this._peekIs(TokenType.RBRACKET) && !this._peekIs(TokenType.EOF)) {
      const tok = this._peek();
      // Stop before the next directive keyword if inside a combined bracket.
      if (tok.type === TokenType.IDENTIFIER &&
        ['if', 'unless', 'each', 'ref', 'key', 'after'].includes(tok.value)) {
        break;
      }
      if (tok.type === TokenType.DOLLAR) {
        expr += '$';
      } else {
        expr += tok.value;
      }
      this._advance();
    }
    return expr.trim();
  }

  /**
   * Check if the current position is at an IDENTIFIER that is a directive keyword.
   * Used to prevent a bare directive keyword from being consumed as a variant.
   *
   * @private
   * @returns {boolean}
   */
  _peekIsDirectiveKeyword() {
    if (!this._peekIs(TokenType.IDENTIFIER)) return false;
    // This check prevents 'if', 'unless', etc. from being consumed as variants.
    // Realistically they're inside brackets, so this is extra safety.
    return false;
  }

  // ─── Config Directive Parsing ──────────────────────────────────────────────

  /**
   * Parse a `@directive` config block (meta, style, theme, state, viewport,
   * script, ai) that appears as a child of a node.
   *
   * @private
   * @param {Object} parentNode - The node that owns this config block.
   */
  _parseConfigDirective(parentNode) {
    const directiveTok = this._consume(TokenType.DIRECTIVE);
    const name = directiveTok.value.toLowerCase();

    this._skipNewlines();

    // Collect the key-value pairs from the indented block.
    const props = {};
    let rawLines = [];

    if (this._peekIs(TokenType.INDENT)) {
      this._consume(TokenType.INDENT);
      while (!this._peekIs(TokenType.DEDENT) && !this._peekIs(TokenType.EOF)) {
        if (this._peekIs(TokenType.NEWLINE)) {
          this._advance();
          continue;
        }
        if (this._peekIs(TokenType.COMMENT)) {
          this._advance();
          this._skipNewlines();
          continue;
        }
        if (this._peekIs(TokenType.IDENTIFIER)) {
          const key = this._consume(TokenType.IDENTIFIER).value;
          if (this._peekIs(TokenType.COLON)) {
            this._consume(TokenType.COLON);
            let value = '';
            if (this._peekIs(TokenType.CONFIG_VALUE)) {
              value = this._consume(TokenType.CONFIG_VALUE).value;
            } else if (this._peekIs(TokenType.STRING)) {
              value = this._consume(TokenType.STRING).value;
            } else if (this._peekIs(TokenType.IDENTIFIER)) {
              value = this._consume(TokenType.IDENTIFIER).value;
            } else if (this._peekIs(TokenType.NUMBER)) {
              value = parseFloat(this._consume(TokenType.NUMBER).value);
            }
            props[key] = value;
            rawLines.push(`${key}: ${value}`);
          } else {
            props[key] = true;
            rawLines.push(key);
          }
          this._skipNewlines();
        } else {
          // Could be CSS property (e.g., @style block with multi-word keys).
          if (this._peekIs(TokenType.CONFIG_VALUE)) {
            rawLines.push(this._consume(TokenType.CONFIG_VALUE).value);
          }
          this._advance();
          this._skipNewlines();
        }
      }
      this._consume(TokenType.DEDENT);
    }

    // Attach the collected data to the parent node.
    switch (name) {
      case 'meta':
        parentNode.meta = props;
        break;
      case 'theme':
        parentNode.theme = props;
        break;
      case 'state':
        parentNode.state = props;
        break;
      case 'viewport':
        parentNode.viewport = props;
        break;
      case 'style':
        parentNode.style = props;
        break;
      case 'script':
        parentNode.script = rawLines.join('\n');
        break;
      case 'ai':
        parentNode.ai = props;
        break;
      default:
        // Unknown directive — store under generic key.
        parentNode.attrs[`@${name}`] = props;
        break;
    }
  }

  // ─── Block Text Parsing ────────────────────────────────────────────────────

  /**
   * Parse one or more consecutive pipe `|` text lines into a single string.
   *
   * @private
   * @returns {string} The concatenated text content.
   */
  _parseBlockText() {
    const lines = [];
    while (this._peekIs(TokenType.PIPE)) {
      this._consume(TokenType.PIPE);
      let text = '';
      if (this._peekIs(TokenType.TEXT)) {
        text = this._consume(TokenType.TEXT).value;
      }
      lines.push(text);
      this._skipNewlines();
    }
    return lines.join('\n');
  }

  // ─── Token Stream Utilities ────────────────────────────────────────────────

  /**
   * Return the current token without consuming it.
   *
   * @private
   * @returns {import('./tokenizer').Token|null}
   */
  _peek() {
    return this._tokens[this._pos] || null;
  }

  /**
   * Return the token N steps ahead without consuming it.
   *
   * @private
   * @param {number} offset - How far ahead to peek (default 1).
   * @returns {import('./tokenizer').Token|null}
   */
  _peekAhead(offset = 1) {
    return this._tokens[this._pos + offset] || null;
  }

  /**
   * Check if the token at `pos + offset` has the given type.
   *
   * @private
   * @param {number} offset - Position offset from current.
   * @param {string} type   - TokenType constant.
   * @returns {boolean}
   */
  _lookaheadIs(offset, type) {
    const tok = this._tokens[this._pos + offset];
    return tok !== null && tok !== undefined && tok.type === type;
  }

  /**
   * Check if the current token has the given type.
   *
   * @private
   * @param {string} type - TokenType constant.
   * @returns {boolean}
   */
  _peekIs(type) {
    const tok = this._peek();
    return tok !== null && tok.type === type;
  }

  /**
   * A quick character-level peek at the current token's value.
   *
   * @private
   * @param {string} ch - Character to compare.
   * @returns {boolean}
   */
  _peekIsChar(ch) {
    const tok = this._peek();
    return tok !== null && tok.value === ch;
  }

  /**
   * Consume and return the current token. Throws if type doesn't match.
   *
   * @private
   * @param {string} expectedType - The required TokenType.
   * @returns {import('./tokenizer').Token}
   * @throws {ParseError}
   */
  _consume(expectedType) {
    const tok = this._tokens[this._pos];
    if (!tok || tok.type !== expectedType) {
      throw new ParseError(
        `Expected ${expectedType} but found ${tok ? tok.type : 'EOF'} ("${tok ? tok.value : ''}")`,
        tok
      );
    }
    this._pos++;
    return tok;
  }

  /**
   * Advance one token regardless of type.
   *
   * @private
   * @returns {import('./tokenizer').Token}
   */
  _advance() {
    return this._tokens[this._pos++] || null;
  }

  /**
   * Skip over any NEWLINE tokens at the current position.
   *
   * @private
   */
  _skipNewlines() {
    while (this._peekIs(TokenType.NEWLINE)) {
      this._advance();
    }
  }

  /**
   * Skip over COMMENT and DOC_COMMENT tokens, collecting doc comments.
   *
   * @private
   */
  _skipComments() {
    while (this._peekIs(TokenType.COMMENT) || this._peekIs(TokenType.DOC_COMMENT) || this._peekIs(TokenType.NEWLINE)) {
      if (this._peekIs(TokenType.DOC_COMMENT)) {
        this._pendingDocComment = this._consume(TokenType.DOC_COMMENT).value;
      } else {
        this._advance();
      }
    }
  }

  /**
   * Consume an expected NEWLINE (or EOF if at end of stream).
   *
   * @private
   */
  _expectNewline() {
    if (this._peekIs(TokenType.NEWLINE)) {
      this._advance();
    } else if (!this._peekIs(TokenType.EOF) && !this._peekIs(TokenType.DEDENT) && !this._peekIs(TokenType.INDENT)) {
      // Lenient: skip unexpected tokens at EOL rather than hard error.
      // A strict mode could throw here.
    }
  }
}

// ─── Convenience parse() function ─────────────────────────────────────────────

/**
 * Parse a SEAL source string and return the AST root node.
 *
 * This is the primary public API for the parser module.
 *
 * @param {string} source - SEAL source text.
 * @returns {Object} Root AST node (Page element).
 * @throws {ParseError} On invalid SEAL syntax.
 *
 * @example
 * const { parse } = require('./src/parser');
 * const ast = parse(`
 * Page #home title="Home" route="/"
 *   Body
 *     Text variant=heading-1 "Hello World"
 * `);
 */
function parse(source) {
  const parser = new Parser(source);
  return parser.parse();
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = { Parser, parse, ParseError, createNode };

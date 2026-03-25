/**
 * @fileoverview SEAL Language Tokenizer
 *
 * Converts raw SEAL source text into a flat stream of typed tokens.
 * The parser then consumes this token stream to build an AST.
 *
 * Token stream order preserves all structural information needed
 * to reconstruct indentation-based nesting:
 *   - INDENT / DEDENT tokens mark scope changes.
 *   - NEWLINE tokens mark statement ends.
 *   - All other tokens carry their original source positions.
 *
 * @module tokenizer
 * @version 0.1.0
 */

'use strict';

// ─── Token Type Constants ────────────────────────────────────────────────────

/**
 * Enumeration of all token types produced by the tokenizer.
 * @readonly
 * @enum {string}
 */
const TokenType = {
  // Structural
  /** Increase in indentation level (2 spaces) */
  INDENT: 'INDENT',
  /** Decrease in indentation level */
  DEDENT: 'DEDENT',
  /** End of a logical line */
  NEWLINE: 'NEWLINE',
  /** End of the token stream */
  EOF: 'EOF',

  // Identifiers & Literals
  /** PascalCase element type name, e.g., "Button", "Form" */
  ELEMENT_TYPE: 'ELEMENT_TYPE',
  /** Bare lowercase identifier / keyword / variant token */
  IDENTIFIER: 'IDENTIFIER',
  /** Double-quoted string literal */
  STRING: 'STRING',
  /** Numeric literal */
  NUMBER: 'NUMBER',

  // Selectors
  /** #id selector, e.g., "#login-form" */
  ID: 'ID',
  /** .role selector, e.g., ".navigation" */
  ROLE: 'ROLE',

  // Operators & Punctuation
  /** '=' assignment in attribute block */
  EQUALS: 'EQUALS',
  /** '[' open bracket for attributes or directives */
  LBRACKET: 'LBRACKET',
  /** ']' close bracket */
  RBRACKET: 'RBRACKET',
  /** '$' state variable prefix */
  DOLLAR: 'DOLLAR',

  // Block text
  /** '|' pipe prefix for block text lines */
  PIPE: 'PIPE',
  /** Raw text content after a pipe */
  TEXT: 'TEXT',

  // Configuration directives
  /** '@keyword' config block opener, e.g., "@meta", "@style" */
  DIRECTIVE: 'DIRECTIVE',
  /** ':' separator in config block property lines */
  COLON: 'COLON',
  /** Raw config/property value (may contain spaces) */
  CONFIG_VALUE: 'CONFIG_VALUE',

  // Comments
  /** Single-line // comment (stripped before parsing) */
  COMMENT: 'COMMENT',
  /** Doc comment /// */
  DOC_COMMENT: 'DOC_COMMENT',
  /** Multi-line block comment (stripped) */
  BLOCK_COMMENT: 'BLOCK_COMMENT',
};

// ─── Token Class ─────────────────────────────────────────────────────────────

/**
 * Represents a single token in the SEAL token stream.
 */
class Token {
  /**
   * @param {string} type    - One of the TokenType constants.
   * @param {string} value   - The raw string value of the token.
   * @param {number} line    - 1-based source line number.
   * @param {number} column  - 1-based source column number.
   */
  constructor(type, value, line, column) {
    /** @type {string} */
    this.type = type;
    /** @type {string} */
    this.value = value;
    /** @type {number} */
    this.line = line;
    /** @type {number} */
    this.column = column;
  }

  /** @returns {string} Human-readable token description for error messages. */
  toString() {
    return `Token(${this.type}, ${JSON.stringify(this.value)}, ${this.line}:${this.column})`;
  }
}

// ─── TokenizerError ───────────────────────────────────────────────────────────

/**
 * Thrown when the tokenizer encounters invalid SEAL syntax.
 */
class TokenizerError extends Error {
  /**
   * @param {string} message  - Human-readable error description.
   * @param {number} line     - Source line number.
   * @param {number} column   - Source column number.
   */
  constructor(message, line, column) {
    super(`Tokenizer error at ${line}:${column} — ${message}`);
    this.name = 'TokenizerError';
    this.line = line;
    this.column = column;
  }
}

// ─── Tokenizer ────────────────────────────────────────────────────────────────

/**
 * SEAL source tokenizer.
 *
 * Usage:
 * ```js
 * const tokenizer = new Tokenizer(source);
 * const tokens = tokenizer.tokenize();
 * ```
 */
class Tokenizer {
  /**
   * @param {string} source - The full SEAL source text.
   */
  constructor(source) {
    /** @private @type {string} */
    this._source = source;
    /** @private @type {string[]} Lines of source split on newlines */
    this._lines = source.split(/\r?\n/);
    /** @private @type {Token[]} Output token array */
    this._tokens = [];
    /** @private @type {number} Current line index (0-based) */
    this._lineIndex = 0;
    /** @private @type {number[]} Stack of indentation levels */
    this._indentStack = [0];
    /** @private @type {boolean} Whether we are inside a config block body */
    this._inConfigBody = false;
    /** @private @type {number} Indent level at which current config block opened */
    this._configBlockIndent = -1;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Tokenize the entire source and return a flat array of tokens.
   *
   * @returns {Token[]} Array of tokens ending with an EOF token.
   * @throws {TokenizerError} On invalid SEAL syntax.
   */
  tokenize() {
    for (this._lineIndex = 0; this._lineIndex < this._lines.length; this._lineIndex++) {
      this._tokenizeLine(this._lines[this._lineIndex]);
    }

    // Close any remaining open indentation blocks.
    while (this._indentStack.length > 1) {
      this._indentStack.pop();
      this._emit(TokenType.DEDENT, '', this._lineIndex + 1, 1);
    }

    this._emit(TokenType.EOF, '', this._lineIndex + 1, 1);
    return this._tokens;
  }

  // ─── Line Tokenizer ────────────────────────────────────────────────────────

  /**
   * Tokenize a single source line.
   *
   * @private
   * @param {string} line - Raw source line (without trailing newline).
   */
  _tokenizeLine(line) {
    const lineNum = this._lineIndex + 1;

    // Skip completely empty lines (they don't change indentation state).
    if (line.trim() === '') {
      return;
    }

    // ── Handle multi-line block comments spanning this line ───────────────
    // (block comment handling is done via stripping before per-line processing)
    const stripped = this._stripBlockComment(line, lineNum);
    if (stripped === null) {
      // Entire line is inside a block comment; skip.
      return;
    }

    // After stripping block comment, if the line is now blank, skip it.
    if (stripped.trim() === '') {
      return;
    }

    // ── Measure indentation ───────────────────────────────────────────────
    const indentCount = this._measureIndent(stripped, lineNum);
    const content = stripped.slice(indentCount);

    // Skip lines that became empty after stripping inline trailing comments
    // (we'll handle inline // comments during content tokenization).
    if (!content) {
      return;
    }

    // ── Emit INDENT / DEDENT based on indent change ───────────────────────
    this._handleIndentation(indentCount, lineNum);

    // ── Single-line // doc or regular comment ─────────────────────────────
    if (content.startsWith('///')) {
      this._emit(TokenType.DOC_COMMENT, content.slice(3).trim(), lineNum, indentCount + 1);
      this._emit(TokenType.NEWLINE, '', lineNum, content.length + indentCount);
      return;
    }
    if (content.startsWith('//')) {
      this._emit(TokenType.COMMENT, content.slice(2).trim(), lineNum, indentCount + 1);
      this._emit(TokenType.NEWLINE, '', lineNum, content.length + indentCount);
      return;
    }

    // ── Config block body lines (property: value) ─────────────────────────
    if (this._inConfigBody && indentCount > this._configBlockIndent) {
      this._tokenizeConfigLine(content, lineNum, indentCount);
      return;
    }

    // ── Block text pipe lines ─────────────────────────────────────────────
    if (content.startsWith('|')) {
      this._emit(TokenType.PIPE, '|', lineNum, indentCount + 1);
      const text = content.slice(1); // May start with a space
      if (text.length > 0) {
        // Strip one leading space if present.
        const textValue = text.startsWith(' ') ? text.slice(1) : text;
        this._emit(TokenType.TEXT, textValue, lineNum, indentCount + 2);
      }
      this._emit(TokenType.NEWLINE, '', lineNum, content.length + indentCount);
      return;
    }

    // ── @directive line ────────────────────────────────────────────────────
    if (content.startsWith('@')) {
      const directiveName = content.match(/^@([a-zA-Z_][a-zA-Z0-9_\-]*)/);
      if (directiveName) {
        this._emit(TokenType.DIRECTIVE, directiveName[1], lineNum, indentCount + 1);
        // A directive line opens a config body at the NEXT indent level.
        this._inConfigBody = true;
        this._configBlockIndent = indentCount;
        // Tokenize any trailing content after the directive keyword.
        const afterDirective = content.slice(directiveName[0].length).trim();
        if (afterDirective) {
          this._tokenizeInlineContent(afterDirective, lineNum, indentCount + directiveName[0].length + 1);
        }
        this._emit(TokenType.NEWLINE, '', lineNum, content.length + indentCount);
        return;
      }
    }

    // ── Normal element / content line ─────────────────────────────────────
    // If we just left a config body, reset the flag.
    if (this._inConfigBody && indentCount <= this._configBlockIndent) {
      this._inConfigBody = false;
      this._configBlockIndent = -1;
    }

    this._tokenizeInlineContent(content, lineNum, indentCount + 1);
    this._emit(TokenType.NEWLINE, '', lineNum, content.length + indentCount);
  }

  // ─── Indentation Handling ──────────────────────────────────────────────────

  /**
   * Measure leading spaces. Validates that indentation is a multiple of 2.
   *
   * @private
   * @param {string} line    - The source line.
   * @param {number} lineNum - 1-based line number for error reporting.
   * @returns {number} Number of leading space characters.
   * @throws {TokenizerError} If tabs are used or indentation is not a multiple of 2.
   */
  _measureIndent(line, lineNum) {
    if (/^\t/.test(line)) {
      throw new TokenizerError(
        'SEAL uses 2-space indentation; tab characters are not allowed.',
        lineNum,
        1
      );
    }
    let count = 0;
    while (count < line.length && line[count] === ' ') {
      count++;
    }
    if (count % 2 !== 0) {
      throw new TokenizerError(
        `Indentation must be a multiple of 2 spaces; found ${count} spaces.`,
        lineNum,
        1
      );
    }
    return count;
  }

  /**
   * Emit INDENT or DEDENT tokens based on how the current line's indent
   * compares to the indent stack.
   *
   * @private
   * @param {number} currentIndent - Current line's leading space count.
   * @param {number} lineNum       - 1-based line number.
   */
  _handleIndentation(currentIndent, lineNum) {
    const topIndent = this._indentStack[this._indentStack.length - 1];

    if (currentIndent > topIndent) {
      // Deeper: push new level and emit INDENT.
      this._indentStack.push(currentIndent);
      this._emit(TokenType.INDENT, '', lineNum, 1);
    } else if (currentIndent < topIndent) {
      // Shallower: pop levels and emit DEDENTs until we match.
      while (this._indentStack.length > 1 && this._indentStack[this._indentStack.length - 1] > currentIndent) {
        this._indentStack.pop();
        this._emit(TokenType.DEDENT, '', lineNum, 1);
      }
      // Validate that we landed on a known indent level.
      if (this._indentStack[this._indentStack.length - 1] !== currentIndent) {
        throw new TokenizerError(
          `Unexpected dedent; no matching indentation level for ${currentIndent} spaces.`,
          lineNum,
          1
        );
      }
    }
    // Equal indent: no structural token needed.
  }

  // ─── Content Tokenizers ────────────────────────────────────────────────────

  /**
   * Tokenize an inline content string (everything after the leading whitespace).
   * Handles element declarations, attributes, directives, and inline text.
   *
   * @private
   * @param {string} content - The content part of the line (no leading spaces).
   * @param {number} lineNum - 1-based line number.
   * @param {number} colBase - Column offset for accurate position reporting.
   */
  _tokenizeInlineContent(content, lineNum, colBase) {
    let pos = 0;

    /** Helper: emit with offset. */
    const emit = (type, value, offset = pos) => {
      this._emit(type, value, lineNum, colBase + offset);
    };

    /** Consume and return the next N characters. */
    const consume = (n = 1) => {
      const val = content.slice(pos, pos + n);
      pos += n;
      return val;
    };

    /** Peek at the character at pos + offset. */
    const peek = (offset = 0) => content[pos + offset];

    /** Skip whitespace. */
    const skipSpaces = () => {
      while (pos < content.length && content[pos] === ' ') pos++;
    };

    while (pos < content.length) {
      skipSpaces();
      if (pos >= content.length) break;

      const ch = peek();
      const startPos = pos;

      // ── Inline single-line comment ────────────────────────────────────
      if (ch === '/' && peek(1) === '/') {
        // Strip the rest of the line — it's a comment.
        // (Do not emit a COMMENT token from inline position — already handled
        //  at the line level for full-line comments. Inline comments just stop
        //  content processing.)
        break;
      }

      // ── Inline block comment ──────────────────────────────────────────
      if (ch === '/' && peek(1) === '*') {
        const end = content.indexOf('*/', pos + 2);
        if (end === -1) {
          // Block comment spans beyond this line — handled by outer state.
          break;
        }
        pos = end + 2;
        continue;
      }

      // ── #id selector ─────────────────────────────────────────────────
      if (ch === '#') {
        pos++;
        const idMatch = content.slice(pos).match(/^[a-z][a-z0-9\-]*/);
        if (!idMatch) {
          throw new TokenizerError('Expected identifier after "#".', lineNum, colBase + pos);
        }
        emit(TokenType.ID, idMatch[0], startPos);
        pos += idMatch[0].length;
        continue;
      }

      // ── .role selector ────────────────────────────────────────────────
      if (ch === '.') {
        pos++;
        const roleMatch = content.slice(pos).match(/^[a-z][a-z0-9\-]*/);
        if (!roleMatch) {
          throw new TokenizerError('Expected identifier after ".".', lineNum, colBase + pos);
        }
        emit(TokenType.ROLE, roleMatch[0], startPos);
        pos += roleMatch[0].length;
        continue;
      }

      // ── $ state variable reference ────────────────────────────────────
      if (ch === '$') {
        emit(TokenType.DOLLAR, '$', startPos);
        pos++;
        continue;
      }

      // ── [ attribute/directive block ────────────────────────────────────
      if (ch === '[') {
        emit(TokenType.LBRACKET, '[', startPos);
        pos++;
        continue;
      }

      // ── ] close bracket ───────────────────────────────────────────────
      if (ch === ']') {
        emit(TokenType.RBRACKET, ']', startPos);
        pos++;
        continue;
      }

      // ── = equals ─────────────────────────────────────────────────────
      if (ch === '=') {
        emit(TokenType.EQUALS, '=', startPos);
        pos++;
        continue;
      }

      // ── Quoted string ─────────────────────────────────────────────────
      if (ch === '"') {
        pos++; // skip opening quote
        let str = '';
        while (pos < content.length && content[pos] !== '"') {
          if (content[pos] === '\\') {
            pos++; // skip backslash
            const escaped = content[pos] || '';
            str += this._resolveEscape(escaped);
            pos++;
          } else {
            str += content[pos++];
          }
        }
        if (pos >= content.length) {
          throw new TokenizerError('Unterminated string literal.', lineNum, colBase + startPos);
        }
        pos++; // skip closing quote
        emit(TokenType.STRING, str, startPos);
        continue;
      }

      // ── Numeric literal ───────────────────────────────────────────────
      if (/[0-9]/.test(ch)) {
        const numMatch = content.slice(pos).match(/^[0-9]+(\.[0-9]+)?/);
        emit(TokenType.NUMBER, numMatch[0], startPos);
        pos += numMatch[0].length;
        continue;
      }

      // ── PascalCase ElementType or bare IDENTIFIER ─────────────────────
      if (/[a-zA-Z_]/.test(ch)) {
        const wordMatch = content.slice(pos).match(/^[a-zA-Z_][a-zA-Z0-9_\-]*/);
        const word = wordMatch[0];
        pos += word.length;

        // Determine token type: PascalCase → ELEMENT_TYPE, else → IDENTIFIER.
        if (/^[A-Z]/.test(word)) {
          emit(TokenType.ELEMENT_TYPE, word, startPos);
        } else {
          emit(TokenType.IDENTIFIER, word, startPos);
        }
        continue;
      }

      // ── Unrecognised character ────────────────────────────────────────
      throw new TokenizerError(
        `Unexpected character "${ch}" (code ${ch.charCodeAt(0)}).`,
        lineNum,
        colBase + pos
      );
    }
  }

  /**
   * Tokenize a config block property line (key: value).
   *
   * @private
   * @param {string} content - Line content after leading whitespace.
   * @param {number} lineNum - 1-based line number.
   * @param {number} colBase - Column base for positions.
   */
  _tokenizeConfigLine(content, lineNum, colBase) {
    // Strip inline comments.
    const commentIdx = content.indexOf('//');
    const cleaned = commentIdx >= 0 ? content.slice(0, commentIdx).trimEnd() : content;

    if (!cleaned.trim()) return;

    // Key: value
    const colonIdx = cleaned.indexOf(':');
    if (colonIdx >= 0) {
      const key = cleaned.slice(0, colonIdx).trim();
      const value = cleaned.slice(colonIdx + 1).trim();

      if (key) {
        this._emit(TokenType.IDENTIFIER, key, lineNum, colBase + 1);
        this._emit(TokenType.COLON, ':', lineNum, colBase + colonIdx + 1);
      }
      if (value) {
        this._emit(TokenType.CONFIG_VALUE, value, lineNum, colBase + colonIdx + 2);
      }
    } else {
      // Bare key (boolean flag).
      this._emit(TokenType.IDENTIFIER, cleaned.trim(), lineNum, colBase + 1);
    }
    this._emit(TokenType.NEWLINE, '', lineNum, colBase + content.length);
  }

  // ─── Block Comment State ───────────────────────────────────────────────────

  /**
   * Simple single-pass block comment stripper.
   * Tracks whether we are currently inside a block comment.
   *
   * @private
   * @param {string} line    - Source line to process.
   * @param {number} lineNum - 1-based line number.
   * @returns {string|null}  - Stripped line, or null if entirely commented.
   */
  _stripBlockComment(line, lineNum) {
    // We use a simple state on the tokenizer instance.
    if (!this._inBlockComment) {
      const openIdx = line.indexOf('/*');
      if (openIdx === -1) return line; // No block comment on this line.

      // Block comment opens on this line.
      const closeIdx = line.indexOf('*/', openIdx + 2);
      if (closeIdx !== -1) {
        // Block comment opens and closes on the same line.
        return line.slice(0, openIdx) + line.slice(closeIdx + 2);
      }
      // Block comment opens but doesn't close — enter block comment state.
      this._inBlockComment = true;
      const before = line.slice(0, openIdx).trimEnd();
      return before.length > 0 ? before : null;
    } else {
      // Currently inside a block comment — look for closing.
      const closeIdx = line.indexOf('*/');
      if (closeIdx === -1) {
        // Still inside block comment.
        return null;
      }
      // Block comment ends on this line.
      this._inBlockComment = false;
      return line.slice(closeIdx + 2);
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Resolve a backslash escape sequence to its character value.
   *
   * @private
   * @param {string} ch - The character after the backslash.
   * @returns {string} The resolved character.
   */
  _resolveEscape(ch) {
    const escapes = { n: '\n', t: '\t', r: '\r', '"': '"', '\\': '\\' };
    return escapes[ch] !== undefined ? escapes[ch] : ch;
  }

  /**
   * Append a token to the output stream.
   *
   * @private
   * @param {string} type   - TokenType constant.
   * @param {string} value  - Token string value.
   * @param {number} line   - 1-based line number.
   * @param {number} column - 1-based column number.
   */
  _emit(type, value, line, column) {
    this._tokens.push(new Token(type, value, line, column));
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = { Tokenizer, Token, TokenType, TokenizerError };

/**
 * @fileoverview SEAL Parser Test Suite
 *
 * Tests for the tokenizer, parser, and validator.
 * Runs with: node tests/parser.test.js
 *
 * Uses a lightweight hand-rolled test harness (no external dependencies).
 */

'use strict';

const { Tokenizer, TokenType, TokenizerError } = require('../src/parser/tokenizer');
const { parse, ParseError } = require('../src/parser/index');
const { validate } = require('../src/parser/validator');

// ─── Micro Test Harness ───────────────────────────────────────────────────────

let _passed = 0;
let _failed = 0;
let _currentSuite = '';

function suite(name, fn) {
  _currentSuite = name;
  console.log(`\n  ${name}`);
  fn();
}

function test(name, fn) {
  try {
    fn();
    _passed++;
    console.log(`    ✓ ${name}`);
  } catch (err) {
    _failed++;
    console.error(`    ✗ ${name}`);
    console.error(`      ${err.message}`);
    if (process.env.SEAL_VERBOSE) {
      console.error(err.stack);
    }
  }
}

function assert(condition, message = 'Assertion failed') {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, label = '') {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${label ? label + ': ' : ''}Expected ${e} but got ${a}`);
  }
}

function assertThrows(fn, ErrorClass, messageFragment) {
  let threw = false;
  let caughtError = null;
  try {
    fn();
  } catch (err) {
    threw = true;
    caughtError = err;
  }
  if (!threw) {
    throw new Error(`Expected function to throw ${ErrorClass ? ErrorClass.name : 'an error'} but it did not.`);
  }
  if (ErrorClass && !(caughtError instanceof ErrorClass)) {
    throw new Error(`Expected error of type ${ErrorClass.name} but got ${caughtError.constructor.name}: ${caughtError.message}`);
  }
  if (messageFragment && !caughtError.message.includes(messageFragment)) {
    throw new Error(`Expected error message to include "${messageFragment}" but got: "${caughtError.message}"`);
  }
}

function assertNoThrow(fn) {
  try {
    fn();
  } catch (err) {
    throw new Error(`Expected no error but got: ${err.message}`);
  }
}

// ─── Tokenizer Tests ──────────────────────────────────────────────────────────

suite('Tokenizer — Basic Token Types', () => {

  test('tokenizes a PascalCase element type', () => {
    const t = new Tokenizer('Button');
    const tokens = t.tokenize().filter(tok => tok.type !== TokenType.EOF && tok.type !== TokenType.NEWLINE);
    assertEqual(tokens[0].type, TokenType.ELEMENT_TYPE);
    assertEqual(tokens[0].value, 'Button');
  });

  test('tokenizes a lowercase identifier as IDENTIFIER', () => {
    const t = new Tokenizer('primary');
    const tokens = t.tokenize().filter(tok => tok.type !== TokenType.EOF && tok.type !== TokenType.NEWLINE);
    assertEqual(tokens[0].type, TokenType.IDENTIFIER);
    assertEqual(tokens[0].value, 'primary');
  });

  test('tokenizes #id selector', () => {
    const t = new Tokenizer('Button #submit-btn');
    const tokens = t.tokenize();
    const idTok = tokens.find(tok => tok.type === TokenType.ID);
    assert(idTok, 'Expected an ID token');
    assertEqual(idTok.value, 'submit-btn');
  });

  test('tokenizes .role selector', () => {
    const t = new Tokenizer('Nav .main-nav');
    const tokens = t.tokenize();
    const roleTok = tokens.find(tok => tok.type === TokenType.ROLE);
    assert(roleTok, 'Expected a ROLE token');
    assertEqual(roleTok.value, 'main-nav');
  });

  test('tokenizes a double-quoted string', () => {
    const t = new Tokenizer('Button "Click me"');
    const tokens = t.tokenize();
    const strTok = tokens.find(tok => tok.type === TokenType.STRING);
    assert(strTok, 'Expected a STRING token');
    assertEqual(strTok.value, 'Click me');
  });

  test('tokenizes a numeric attribute value', () => {
    const t = new Tokenizer('Grid [cols=3]');
    const tokens = t.tokenize();
    const numTok = tokens.find(tok => tok.type === TokenType.NUMBER);
    assert(numTok, 'Expected a NUMBER token');
    assertEqual(numTok.value, '3');
  });

  test('tokenizes [ and ] as brackets', () => {
    const t = new Tokenizer('[required]');
    const tokens = t.tokenize();
    assert(tokens.some(tok => tok.type === TokenType.LBRACKET), 'Expected LBRACKET');
    assert(tokens.some(tok => tok.type === TokenType.RBRACKET), 'Expected RBRACKET');
  });

  test('tokenizes = as EQUALS', () => {
    const t = new Tokenizer('[type=email]');
    const tokens = t.tokenize();
    assert(tokens.some(tok => tok.type === TokenType.EQUALS), 'Expected EQUALS token');
  });

  test('tokenizes $ as DOLLAR', () => {
    const t = new Tokenizer('[disabled=$loading]');
    const tokens = t.tokenize();
    assert(tokens.some(tok => tok.type === TokenType.DOLLAR), 'Expected DOLLAR token');
  });

  test('tokenizes @directive', () => {
    const t = new Tokenizer('@meta');
    const tokens = t.tokenize();
    const dirTok = tokens.find(tok => tok.type === TokenType.DIRECTIVE);
    assert(dirTok, 'Expected a DIRECTIVE token');
    assertEqual(dirTok.value, 'meta');
  });

  test('strips single-line comments', () => {
    const t = new Tokenizer('// This is a comment\nButton "OK"');
    const tokens = t.tokenize();
    const commentToks = tokens.filter(tok => tok.type === TokenType.COMMENT);
    const btnTok = tokens.find(tok => tok.type === TokenType.ELEMENT_TYPE);
    assert(commentToks.length === 1, 'Expected one COMMENT token');
    assertEqual(commentToks[0].value, 'This is a comment');
    assert(btnTok && btnTok.value === 'Button', 'Expected Button after comment');
  });

  test('tokenizes doc comments with ///', () => {
    const t = new Tokenizer('/// My element docs\nButton');
    const tokens = t.tokenize();
    const docTok = tokens.find(tok => tok.type === TokenType.DOC_COMMENT);
    assert(docTok, 'Expected a DOC_COMMENT token');
    assertEqual(docTok.value, 'My element docs');
  });

  test('tokenizes pipe for block text', () => {
    const t = new Tokenizer('| Hello world');
    const tokens = t.tokenize();
    const pipeTok = tokens.find(tok => tok.type === TokenType.PIPE);
    assert(pipeTok, 'Expected PIPE token');
    const textTok = tokens.find(tok => tok.type === TokenType.TEXT);
    assert(textTok, 'Expected TEXT token');
    assertEqual(textTok.value, 'Hello world');
  });

  test('emits INDENT and DEDENT for nested content', () => {
    const src = 'Section\n  Button "Click"';
    const t = new Tokenizer(src);
    const tokens = t.tokenize();
    assert(tokens.some(tok => tok.type === TokenType.INDENT), 'Expected INDENT');
    assert(tokens.some(tok => tok.type === TokenType.DEDENT), 'Expected DEDENT');
  });

  test('emits multiple DEDENT tokens for multiple dedents', () => {
    const src = 'A\n  B\n    C\nD';
    const t = new Tokenizer(src);
    const tokens = t.tokenize();
    const dedents = tokens.filter(tok => tok.type === TokenType.DEDENT);
    assert(dedents.length >= 2, `Expected at least 2 DEDENTs, got ${dedents.length}`);
  });

  test('throws TokenizerError for tab indentation', () => {
    assertThrows(
      () => new Tokenizer('\tButton').tokenize(),
      TokenizerError,
      'tab'
    );
  });

  test('throws TokenizerError for odd indentation', () => {
    assertThrows(
      () => new Tokenizer('Section\n   Button').tokenize(),
      TokenizerError,
      'multiple of 2'
    );
  });

  test('handles escape sequences in strings', () => {
    const t = new Tokenizer('"Hello\\nWorld"');
    const tokens = t.tokenize();
    const strTok = tokens.find(tok => tok.type === TokenType.STRING);
    assert(strTok, 'Expected STRING token');
    assertEqual(strTok.value, 'Hello\nWorld');
  });

  test('handles strings with escaped quotes', () => {
    const t = new Tokenizer('"Say \\"hello\\""');
    const tokens = t.tokenize();
    const strTok = tokens.find(tok => tok.type === TokenType.STRING);
    assertEqual(strTok.value, 'Say "hello"');
  });

  test('strips inline block comments', () => {
    const t = new Tokenizer('Button /* ignored */ "OK"');
    const tokens = t.tokenize();
    const strTok = tokens.find(tok => tok.type === TokenType.STRING);
    assert(strTok && strTok.value === 'OK', 'Expected STRING "OK" after block comment');
  });

  test('handles multi-line block comment spanning lines', () => {
    const src = 'Section\n/*\nignored\n*/\nButton';
    const t = new Tokenizer(src);
    const tokens = t.tokenize();
    const elementTypes = tokens
      .filter(tok => tok.type === TokenType.ELEMENT_TYPE)
      .map(tok => tok.value);
    assert(elementTypes.includes('Section'), 'Expected Section');
    assert(elementTypes.includes('Button'), 'Expected Button');
  });

  test('throws on unterminated string', () => {
    assertThrows(
      () => new Tokenizer('"unterminated').tokenize(),
      TokenizerError,
      'Unterminated string'
    );
  });
});

// ─── Parser Tests — Basic Elements ───────────────────────────────────────────

suite('Parser — Basic Element Parsing', () => {

  test('parses a minimal Page element', () => {
    const ast = parse('Page #home title="Home" route="/"\n  Body\n');
    assertEqual(ast.type, 'Page');
    assertEqual(ast.id, 'home');
    assertEqual(ast.attrs.title, 'Home');
    assertEqual(ast.attrs.route, '/');
  });

  test('parses inline text on a Button', () => {
    const src = 'Page\n  Body\n    Button "Click me"\n';
    const ast = parse(src);
    const btn = ast.children[0].children[0];
    assertEqual(btn.type, 'Button');
    assertEqual(btn.text, 'Click me');
  });

  test('parses element with #id', () => {
    const src = 'Page\n  Body\n    Input #email\n';
    const ast = parse(src);
    const input = ast.children[0].children[0];
    assertEqual(input.id, 'email');
  });

  test('parses element with .role', () => {
    const src = 'Page\n  Body\n    Nav .primary-nav\n';
    const ast = parse(src);
    const nav = ast.children[0].children[0];
    assertEqual(nav.role, 'primary-nav');
  });

  test('parses element variant token', () => {
    const src = 'Page\n  Body\n    Button primary "Go"\n';
    const ast = parse(src);
    const btn = ast.children[0].children[0];
    assertEqual(btn.variant, 'primary');
  });

  test('parses element with both #id and variant', () => {
    const src = 'Page\n  Body\n    Button #submit primary "Go"\n';
    const ast = parse(src);
    const btn = ast.children[0].children[0];
    assertEqual(btn.id, 'submit');
    assertEqual(btn.variant, 'primary');
  });

  test('parses line number and column on nodes', () => {
    const src = 'Page\n  Body\n    Button "OK"\n';
    const ast = parse(src);
    assert(typeof ast.line === 'number', 'Expected line number on Page');
    const btn = ast.children[0].children[0];
    assert(typeof btn.line === 'number', 'Expected line number on Button');
  });

});

// ─── Parser Tests — Attribute Parsing ─────────────────────────────────────────

suite('Parser — Attribute Parsing', () => {

  test('parses unquoted attribute value', () => {
    const src = 'Page\n  Body\n    Input [type=email]\n';
    const ast = parse(src);
    const input = ast.children[0].children[0];
    assertEqual(input.attrs.type, 'email');
  });

  test('parses quoted attribute value', () => {
    const src = 'Page\n  Body\n    Input [placeholder="Enter email"]\n';
    const ast = parse(src);
    const input = ast.children[0].children[0];
    assertEqual(input.attrs.placeholder, 'Enter email');
  });

  test('parses boolean (bare) attribute', () => {
    const src = 'Page\n  Body\n    Input [required]\n';
    const ast = parse(src);
    const input = ast.children[0].children[0];
    assertEqual(input.attrs.required, true);
  });

  test('parses multiple attributes in one block', () => {
    const src = 'Page\n  Body\n    Input [type=email required placeholder="email"]\n';
    const ast = parse(src);
    const input = ast.children[0].children[0];
    assertEqual(input.attrs.type, 'email');
    assertEqual(input.attrs.required, true);
    assertEqual(input.attrs.placeholder, 'email');
  });

  test('parses numeric attribute value as number', () => {
    const src = 'Page\n  Body\n    Grid [cols=3]\n';
    const ast = parse(src);
    const grid = ast.children[0].children[0];
    assertEqual(grid.attrs.cols, 3);
  });

  test('parses $ state binding in attribute', () => {
    const src = 'Page\n  Body\n    Button [disabled=$isLoading]\n';
    const ast = parse(src);
    const btn = ast.children[0].children[0];
    assertEqual(btn.attrs.disabled, '$isLoading');
  });

  test('parses PascalCase attribute value (e.g., method=POST)', () => {
    const src = 'Page\n  Body\n    Form [action="/api" method=POST]\n';
    const ast = parse(src);
    const form = ast.children[0].children[0];
    assertEqual(form.attrs.method, 'POST');
  });

  test('parses multiple attribute blocks on one element', () => {
    const src = 'Page\n  Body\n    Button [disabled=$x] [type=submit]\n';
    const ast = parse(src);
    const btn = ast.children[0].children[0];
    assert(btn.attrs.disabled === '$x', 'Expected disabled=$x');
    assertEqual(btn.attrs.type, 'submit');
  });

});

// ─── Parser Tests — Nesting ───────────────────────────────────────────────────

suite('Parser — Nested Elements', () => {

  test('parses single level of nesting', () => {
    const src = 'Page\n  Body\n    Section\n      Text "Hello"\n';
    const ast = parse(src);
    const section = ast.children[0].children[0];
    assertEqual(section.type, 'Section');
    assertEqual(section.children[0].type, 'Text');
    assertEqual(section.children[0].text, 'Hello');
  });

  test('parses multiple siblings at same level', () => {
    const src = 'Page\n  Body\n    Button "A"\n    Button "B"\n    Button "C"\n';
    const ast = parse(src);
    const body = ast.children[0];
    assertEqual(body.children.length, 3);
  });

  test('parses deep nesting (4 levels)', () => {
    const src = [
      'Page',
      '  Body',
      '    Section',
      '      Card',
      '        Form',
      '          Input #email',
    ].join('\n') + '\n';
    const ast = parse(src);
    const section = ast.children[0].children[0];
    const card = section.children[0];
    const form = card.children[0];
    const input = form.children[0];
    assertEqual(section.type, 'Section');
    assertEqual(card.type, 'Card');
    assertEqual(form.type, 'Form');
    assertEqual(input.type, 'Input');
    assertEqual(input.id, 'email');
  });

  test('parses mixed-depth siblings correctly', () => {
    const src = [
      'Page',
      '  Body',
      '    Section',
      '      Text "Inner"',
      '    Footer',
      '      Text "Footer"',
    ].join('\n') + '\n';
    const ast = parse(src);
    const body = ast.children[0];
    assertEqual(body.children.length, 2);
    assertEqual(body.children[0].type, 'Section');
    assertEqual(body.children[1].type, 'Footer');
  });

  test('parses block text with pipe syntax', () => {
    const src = [
      'Page',
      '  Body',
      '    Text',
      '      | First line',
      '      | Second line',
    ].join('\n') + '\n';
    const ast = parse(src);
    const textNode = ast.children[0].children[0];
    assert(textNode.text.includes('First line'), 'Expected first line in text');
    assert(textNode.text.includes('Second line'), 'Expected second line in text');
  });

  test('parses Form with multiple Input children', () => {
    const src = [
      'Page',
      '  Body',
      '    Form #login [action="/login" method=POST]',
      '      Input #email [type=email required]',
      '      Input #password [type=password required]',
      '      Button #submit primary [submit=true] "Sign In"',
    ].join('\n') + '\n';
    const ast = parse(src);
    const form = ast.children[0].children[0];
    assertEqual(form.type, 'Form');
    assertEqual(form.id, 'login');
    assertEqual(form.children.length, 3);
    assertEqual(form.children[0].type, 'Input');
    assertEqual(form.children[2].type, 'Button');
    assertEqual(form.children[2].variant, 'primary');
    assertEqual(form.children[2].text, 'Sign In');
  });

});

// ─── Parser Tests — Directives ────────────────────────────────────────────────

suite('Parser — Directives', () => {

  test('parses [if $condition] directive', () => {
    const src = 'Page\n  Body\n    Alert [if $error] "Error!"\n';
    const ast = parse(src);
    const alert = ast.children[0].children[0];
    assert(alert.directives.length > 0, 'Expected directives');
    assertEqual(alert.directives[0].kind, 'if');
    assert(alert.directives[0].expr.includes('error'), 'Expected expr to contain "error"');
  });

  test('parses [unless $condition] directive', () => {
    const src = 'Page\n  Body\n    Button [unless $isPro] "Upgrade"\n';
    const ast = parse(src);
    const btn = ast.children[0].children[0];
    assertEqual(btn.directives[0].kind, 'unless');
  });

  test('parses [each item in $list] directive', () => {
    const src = [
      'Page',
      '  Body',
      '    List',
      '      Item [each product in $products]',
      '        Text "Product"',
    ].join('\n') + '\n';
    const ast = parse(src);
    const list = ast.children[0].children[0];
    const item = list.children[0];
    assertEqual(item.directives[0].kind, 'each');
    assertEqual(item.directives[0].variable, 'product');
    assertEqual(item.directives[0].list, '$products');
  });

  test('parses multiple directives on one element', () => {
    const src = 'Page\n  Body\n    Item [each x in $items] [if $x.visible] "Item"\n';
    const ast = parse(src);
    const item = ast.children[0].children[0];
    assert(item.directives.length >= 2, 'Expected at least 2 directives');
    assertEqual(item.directives[0].kind, 'each');
    assertEqual(item.directives[1].kind, 'if');
  });

});

// ─── Parser Tests — Config / Annotation Blocks ───────────────────────────────

suite('Parser — Config Blocks', () => {

  test('parses @meta block on Page', () => {
    const src = [
      'Page #p title="T" route="/"',
      '  @meta',
      '    description: My page description',
      '  Body',
    ].join('\n') + '\n';
    const ast = parse(src);
    assert(ast.meta !== null, 'Expected meta block on Page');
    assertEqual(ast.meta.description, 'My page description');
  });

  test('parses @state block on Page', () => {
    const src = [
      'Page #p',
      '  @state',
      '    count: 0',
      '    name: John',
      '  Body',
    ].join('\n') + '\n';
    const ast = parse(src);
    assert(ast.state !== null, 'Expected state block');
    assertEqual(ast.state.count, '0');
    assertEqual(ast.state.name, 'John');
  });

  test('parses @theme block on Page', () => {
    const src = [
      'Page #p',
      '  @theme',
      '    primary: #3b82f6',
      '  Body',
    ].join('\n') + '\n';
    const ast = parse(src);
    assert(ast.theme !== null, 'Expected theme block');
    assertEqual(ast.theme.primary, '#3b82f6');
  });

  test('parses @style block on a child element', () => {
    const src = [
      'Page',
      '  Body',
      '    Card',
      '      @style',
      '        background: red',
      '        padding: 16px',
    ].join('\n') + '\n';
    const ast = parse(src);
    const card = ast.children[0].children[0];
    assert(card.style !== null, 'Expected style block on Card');
    assertEqual(card.style.background, 'red');
    assertEqual(card.style.padding, '16px');
  });

  test('parses @ai annotation block', () => {
    const src = [
      'Page',
      '  Body',
      '    Input #search',
      '      @ai',
      '        hint: Search for products',
    ].join('\n') + '\n';
    const ast = parse(src);
    const input = ast.children[0].children[0];
    assert(input.ai !== null, 'Expected ai block on Input');
    assertEqual(input.ai.hint, 'Search for products');
  });

  test('attaches doc comment to following element', () => {
    const src = [
      'Page',
      '  Body',
      '    /// This is the main action button',
      '    Button #submit "Submit"',
    ].join('\n') + '\n';
    const ast = parse(src);
    const btn = ast.children[0].children[0];
    assertEqual(btn.docComment, 'This is the main action button');
  });

});

// ─── Parser Tests — Comments ──────────────────────────────────────────────────

suite('Parser — Comments', () => {

  test('ignores single-line comments before element', () => {
    const src = 'Page\n  Body\n    // comment\n    Button "OK"\n';
    const ast = parse(src);
    const body = ast.children[0];
    assertEqual(body.children.length, 1);
    assertEqual(body.children[0].type, 'Button');
  });

  test('ignores inline // comment after element', () => {
    // Inline comments are stripped by the tokenizer; the element still parses.
    const src = 'Page\n  Body\n    Button "OK" // inline comment\n';
    assertNoThrow(() => parse(src));
  });

  test('ignores multi-line block comments', () => {
    const src = [
      'Page',
      '  Body',
      '    /*',
      '      This whole block is a comment',
      '    */',
      '    Button "OK"',
    ].join('\n') + '\n';
    const ast = parse(src);
    assertEqual(ast.children[0].children.length, 1);
    assertEqual(ast.children[0].children[0].type, 'Button');
  });

});

// ─── Parser Tests — Full Login Page ───────────────────────────────────────────

suite('Parser — Full Login Page Integration', () => {

  const LOGIN_PAGE = `
Page #login-page title="Login" route="/login"
  @meta
    description: Sign in to your account

  @state
    loginError: ""
    isSubmitting: false

  Body
    Section #login-section variant=centered
      Card #login-card elevated
        Header
          Text variant=heading-1 "Welcome Back"
          Text variant=body color=muted "Sign in to continue"

        Form #login-form action="/api/auth/login" method=POST validate=true
          Input #email type=email label="Email Address" required placeholder="you@example.com"
          Input #password type=password label="Password" required

          Flex direction=row align=center justify=between
            Checkbox #remember label="Remember me"
            Link #forgot href="/forgot" "Forgot password?"

          Button #submit variant=primary submit=true "Sign In"

          Alert #error-alert variant=danger [if $loginError]
            "$loginError"

        Divider

        Flex direction=row gap=sm justify=center
          Text variant=body color=muted "Don't have an account?"
          Link #signup href="/signup" "Sign up"
`.trim() + '\n';

  test('parses login page without throwing', () => {
    assertNoThrow(() => parse(LOGIN_PAGE));
  });

  test('login page root is Page with correct metadata', () => {
    const ast = parse(LOGIN_PAGE);
    assertEqual(ast.type, 'Page');
    assertEqual(ast.id, 'login-page');
    assertEqual(ast.attrs.title, 'Login');
    assertEqual(ast.attrs.route, '/login');
  });

  test('login page has meta block', () => {
    const ast = parse(LOGIN_PAGE);
    assert(ast.meta !== null, 'Expected meta block');
  });

  test('login page has state block', () => {
    const ast = parse(LOGIN_PAGE);
    assert(ast.state !== null, 'Expected state block');
  });

  test('login page Body contains Section', () => {
    const ast = parse(LOGIN_PAGE);
    const body = ast.children[0];
    assertEqual(body.type, 'Body');
    assertEqual(body.children[0].type, 'Section');
    assertEqual(body.children[0].id, 'login-section');
  });

  test('login form has correct action and method', () => {
    const ast = parse(LOGIN_PAGE);
    const body = ast.children[0];
    const section = body.children[0];
    const card = section.children[0];
    // Find Form in card's children (after Header).
    const form = card.children.find(c => c.type === 'Form');
    assert(form, 'Expected Form in Card');
    assertEqual(form.id, 'login-form');
    assertEqual(form.attrs.action, '/api/auth/login');
    assertEqual(form.attrs.method, 'POST');
  });

  test('login form contains email and password inputs', () => {
    const ast = parse(LOGIN_PAGE);
    const body = ast.children[0];
    const section = body.children[0];
    const card = section.children[0];
    const form = card.children.find(c => c.type === 'Form');
    const inputs = form.children.filter(c => c.type === 'Input');
    assert(inputs.length >= 2, `Expected at least 2 inputs, got ${inputs.length}`);
    assertEqual(inputs[0].id, 'email');
    assertEqual(inputs[1].id, 'password');
  });

  test('Alert has [if $loginError] directive', () => {
    const ast = parse(LOGIN_PAGE);
    const body = ast.children[0];
    const section = body.children[0];
    const card = section.children[0];
    const form = card.children.find(c => c.type === 'Form');
    const alert = form.children.find(c => c.type === 'Alert');
    assert(alert, 'Expected Alert in Form');
    assert(alert.directives.some(d => d.kind === 'if'), 'Expected [if] directive on Alert');
  });

  test('submit button has variant=primary', () => {
    const ast = parse(LOGIN_PAGE);
    const body = ast.children[0];
    const section = body.children[0];
    const card = section.children[0];
    const form = card.children.find(c => c.type === 'Form');
    const submit = form.children.find(c => c.type === 'Button' && c.id === 'submit');
    assert(submit, 'Expected Button #submit');
    assertEqual(submit.variant, 'primary');
    assertEqual(submit.text, 'Sign In');
  });

});

// ─── Validator Tests ──────────────────────────────────────────────────────────

suite('Validator — Structural Errors', () => {

  test('reports E001 when root is not Page', () => {
    // Validator takes an AST directly; we craft a fake one.
    const fakeAst = { type: 'Section', children: [], directives: [], attrs: {}, line: 1, column: 1 };
    const { errors } = validate(fakeAst);
    assert(errors.some(e => e.code === 'E001'), 'Expected E001 for non-Page root');
  });

  test('reports E002 when Page has no Body', () => {
    const src = 'Page #p title="T" route="/"\n';
    const ast = parse(src);
    const { errors } = validate(ast);
    assert(errors.some(e => e.code === 'E002'), 'Expected E002 for missing Body');
  });

  test('no E002 when Page has a Body', () => {
    const src = 'Page #p title="T" route="/"\n  Body\n';
    const ast = parse(src);
    const { errors } = validate(ast);
    assert(!errors.some(e => e.code === 'E002'), 'Did not expect E002');
  });

  test('reports E020 for Image without src', () => {
    const src = 'Page\n  Body\n    Image alt="logo"\n';
    const ast = parse(src);
    const { errors } = validate(ast);
    assert(errors.some(e => e.code === 'E020'), 'Expected E020 for missing src');
  });

  test('reports E030 for Link without href', () => {
    const src = 'Page\n  Body\n    Link "Click"\n';
    const ast = parse(src);
    const { errors } = validate(ast);
    assert(errors.some(e => e.code === 'E030'), 'Expected E030 for missing href');
  });

  test('reports E040 for invalid Form method', () => {
    const src = 'Page\n  Body\n    Form [action="/x" method=PUT]\n      Button [submit=true] "Go"\n';
    const ast = parse(src);
    const { errors } = validate(ast);
    assert(errors.some(e => e.code === 'E040'), 'Expected E040 for invalid method');
  });

  test('reports E050 for [each] without variable', () => {
    // Craft AST directly with a broken directive.
    const { createNode } = require('../src/parser/index');
    const page = createNode('Page', 1, 1);
    const body = createNode('Body', 2, 1);
    page.children.push(body);
    const item = createNode('Item', 3, 1);
    item.directives.push({ kind: 'each', expr: null, variable: null, list: '$items' });
    body.children.push(item);
    const { errors } = validate(page);
    assert(errors.some(e => e.code === 'E050'), 'Expected E050 for missing each variable');
  });

  test('reports E010 for element with both text and children', () => {
    const { createNode } = require('../src/parser/index');
    const page = createNode('Page', 1, 1);
    const body = createNode('Body', 2, 1);
    page.children.push(body);
    const span = createNode('Span', 3, 1);
    span.text = 'Inline text';
    span.children.push(createNode('Strong', 4, 1));
    body.children.push(span);
    const { errors } = validate(page);
    assert(errors.some(e => e.code === 'E010'), 'Expected E010 for text + children coexistence');
  });

});

suite('Validator — Warnings', () => {

  test('warns W020 for interactive element without #id', () => {
    const src = 'Page\n  Body\n    Button "Click"\n';
    const ast = parse(src);
    const { warnings } = validate(ast);
    assert(warnings.some(w => w.code === 'W020'), 'Expected W020 for Button without id');
  });

  test('no W020 for interactive element with #id', () => {
    const src = 'Page\n  Body\n    Button #btn "Click"\n';
    const ast = parse(src);
    const { warnings } = validate(ast);
    assert(!warnings.some(w => w.code === 'W020'), 'Did not expect W020 when id present');
  });

  test('warns W021 for Image without alt', () => {
    const src = 'Page\n  Body\n    Image [src="/x.png"]\n';
    const ast = parse(src);
    const { warnings } = validate(ast);
    assert(warnings.some(w => w.code === 'W021'), 'Expected W021 for missing alt');
  });

  test('warns W031 for _blank link without rel=noopener', () => {
    const src = 'Page\n  Body\n    Link #ext [href="https://x.com" target=_blank] "External"\n';
    const ast = parse(src);
    const { warnings } = validate(ast);
    assert(warnings.some(w => w.code === 'W031'), 'Expected W031 for _blank link without noopener');
  });

  test('no W031 when rel includes noopener', () => {
    const src = 'Page\n  Body\n    Link #ext [href="https://x.com" target=_blank rel="noopener noreferrer"] "External"\n';
    const ast = parse(src);
    const { warnings } = validate(ast);
    assert(!warnings.some(w => w.code === 'W031'), 'Did not expect W031 when noopener present');
  });

  test('warns W040 for Form without action', () => {
    const src = 'Page\n  Body\n    Form\n      Button #s [submit=true] "Go"\n';
    const ast = parse(src);
    const { warnings } = validate(ast);
    assert(warnings.some(w => w.code === 'W040'), 'Expected W040 for Form without action');
  });

  test('warns W041 for Form without submit button', () => {
    const src = 'Page\n  Body\n    Form [action="/x"]\n      Input #name [type=text]\n';
    const ast = parse(src);
    const { warnings } = validate(ast);
    assert(warnings.some(w => w.code === 'W041'), 'Expected W041 for Form without submit');
  });

  test('no W041 when Form has submit button', () => {
    const src = 'Page\n  Body\n    Form [action="/x"]\n      Input #name [type=text]\n      Button #s [submit=true] "Go"\n';
    const ast = parse(src);
    const { warnings } = validate(ast);
    assert(!warnings.some(w => w.code === 'W041'), 'Did not expect W041 when submit button present');
  });

  test('warns W050 for email Input outside Form', () => {
    const src = 'Page\n  Body\n    Input #e [type=email required]\n';
    const ast = parse(src);
    const { warnings } = validate(ast);
    assert(warnings.some(w => w.code === 'W050'), 'Expected W050 for email input outside form');
  });

  test('no W050 for email Input inside Form', () => {
    const src = 'Page\n  Body\n    Form [action="/x"]\n      Input #e [type=email required]\n      Button #s [submit=true] "Go"\n';
    const ast = parse(src);
    const { warnings } = validate(ast);
    assert(!warnings.some(w => w.code === 'W050'), 'Did not expect W050 inside Form');
  });

  test('warns W001 for Page without title', () => {
    const src = 'Page #p\n  Body\n';
    const ast = parse(src);
    const { warnings } = validate(ast);
    assert(warnings.some(w => w.code === 'W001'), 'Expected W001 for missing title');
  });

  test('warns W070 for Button without text or aria-label', () => {
    const src = 'Page\n  Body\n    Button #b\n';
    const ast = parse(src);
    const { warnings } = validate(ast);
    assert(warnings.some(w => w.code === 'W070'), 'Expected W070 for empty button');
  });

  test('warns W080 for Table without header cells', () => {
    const src = 'Page\n  Body\n    Table #t\n      TableRow\n        TableCell "Data"\n';
    const ast = parse(src);
    const { warnings } = validate(ast);
    assert(warnings.some(w => w.code === 'W080'), 'Expected W080 for table without headers');
  });

  test('warns W061 for Select without options', () => {
    const src = 'Page\n  Body\n    Form [action="/x"]\n      Select #s [label="Choose"]\n      Button #sub [submit=true] "Go"\n';
    const ast = parse(src);
    const { warnings } = validate(ast);
    assert(warnings.some(w => w.code === 'W061'), 'Expected W061 for Select without Options');
  });

  test('no W061 for Select with Option children', () => {
    const src = [
      'Page',
      '  Body',
      '    Form [action="/x"]',
      '      Select #s [label="Choose"]',
      '        Option [value=a] "Option A"',
      '        Option [value=b] "Option B"',
      '      Button #sub [submit=true] "Go"',
    ].join('\n') + '\n';
    const ast = parse(src);
    const { warnings } = validate(ast);
    assert(!warnings.some(w => w.code === 'W061'), 'Did not expect W061 when Options are present');
  });

});

// ─── Error Cases ──────────────────────────────────────────────────────────────

suite('Parser — Error Cases', () => {

  test('throws ParseError if document does not start with Page', () => {
    assertThrows(
      () => parse('Section\n  Text "Hello"\n'),
      ParseError,
      'Page'
    );
  });

  test('throws TokenizerError for tab indentation', () => {
    assertThrows(
      () => parse('Page\n\tBody\n'),
      TokenizerError,
      'tab'
    );
  });

  test('throws on unterminated string literal', () => {
    assertThrows(
      () => parse('Page\n  Body\n    Button "unterminated\n'),
      TokenizerError,
      'Unterminated'
    );
  });

});

// ─── Result Summary ───────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(50));
console.log(`  Results: ${_passed} passed, ${_failed} failed`);
console.log('─'.repeat(50) + '\n');

if (_failed > 0) {
  process.exit(1);
}

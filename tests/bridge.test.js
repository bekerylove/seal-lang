/**
 * @fileoverview SEAL AI-Bridge Tests
 */

const { scan } = require('../src/bridge/index');
const assert = require('assert');

/**
 * Mock DOM for testing Bridge in Node.js environment
 */
class MockElement {
  constructor(tagName, attrs = {}, text = '') {
    this.tagName = tagName.toUpperCase();
    this.attrs = attrs;
    this.id = attrs.id || '';
    this.placeholder = attrs.placeholder || '';
    this.innerText = text;
    this.getAttribute = (name) => this.attrs[name] || null;
  }
}

class MockDocument {
  constructor(elements) {
    this.elements = elements;
  }
  querySelectorAll(selector) {
    // Simple mock selector handling
    return this.elements;
  }
}

function testBridge() {
  console.log('Running AI-Bridge tests...');

  const mockDoc = new MockDocument([
    new MockElement('INPUT', { id: 'email', placeholder: 'Enter email' }),
    new MockElement('BUTTON', { id: 'submit' }, 'Sign In'),
    new MockElement('A', { href: '/help', 'data-seal-label': 'Support' }, 'Help Center'),
    new MockElement('DIV', { 'data-seal-id': 'custom-widget', 'data-seal-label': 'Custom' })
  ]);

  const manifest = scan(mockDoc);

  // We expect 3 elements because the 'A' element has no ID or data-seal-id
  assert.strictEqual(manifest.actions.length, 3);
  
  // Check Email Input
  const email = manifest.actions.find(a => a.id === 'email');
  assert.strictEqual(email.type, 'Input');
  assert.strictEqual(email.label, 'Enter email');
  assert.deepStrictEqual(email.actions, ['FILL', 'READ']);

  // Check Submit Button
  const submit = manifest.actions.find(a => a.id === 'submit');
  assert.strictEqual(submit.type, 'Button');
  assert.strictEqual(submit.label, 'Sign In');
  assert.deepStrictEqual(submit.actions, ['CLICK']);

  // Check Custom Widget
  const custom = manifest.actions.find(a => a.id === 'custom-widget');
  assert.strictEqual(custom.label, 'Custom');
  
  console.log('AI-Bridge tests passed! ✅');
}

try {
  testBridge();
} catch (err) {
  console.error('AI-Bridge tests failed! ❌');
  console.error(err);
  process.exit(1);
}

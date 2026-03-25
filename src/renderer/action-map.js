/**
 * @fileoverview SEAL Action Map
 *
 * Defines which AI-driven actions are available for each SEAL element type.
 * These actions are embedded as `data-seal-actions` attributes on rendered HTML
 * elements, enabling AI agents to discover and invoke interactions without
 * parsing any HTML structure.
 *
 * @module seal/renderer/action-map
 */

'use strict';

/**
 * A mapping from SEAL element type names to the list of action tokens an AI
 * agent (or automation layer) may perform on that element.
 *
 * Action tokens are upper-case strings that represent intent-level operations,
 * not low-level DOM events.
 *
 * @type {Readonly<Record<string, readonly string[]>>}
 */
const ACTION_MAP = Object.freeze({
  // ── Form controls ──────────────────────────────────────────────────────────
  Input:    Object.freeze(['FILL', 'CLEAR', 'FOCUS', 'BLUR', 'READ']),
  Textarea: Object.freeze(['FILL', 'CLEAR', 'FOCUS', 'BLUR', 'READ']),
  Select:   Object.freeze(['SELECT', 'FOCUS', 'BLUR', 'READ']),
  Checkbox: Object.freeze(['CHECK', 'UNCHECK', 'TOGGLE', 'READ']),
  Radio:    Object.freeze(['SELECT', 'READ']),

  // ── Form container ─────────────────────────────────────────────────────────
  Form: Object.freeze(['SUBMIT', 'RESET', 'VALIDATE', 'READ']),

  // ── Interactive elements ────────────────────────────────────────────────────
  Button: Object.freeze(['CLICK', 'FOCUS', 'BLUR']),
  Link:   Object.freeze(['CLICK', 'NAVIGATE', 'READ']),

  // ── Media & display ─────────────────────────────────────────────────────────
  Image: Object.freeze(['READ', 'INSPECT']),
  Icon:  Object.freeze(['READ']),

  // ── Overlay / feedback ──────────────────────────────────────────────────────
  Dialog:   Object.freeze(['OPEN', 'CLOSE', 'READ']),
  Toast:    Object.freeze(['DISMISS', 'READ']),
  Alert:    Object.freeze(['DISMISS', 'READ']),
  Progress: Object.freeze(['READ']),
  Spinner:  Object.freeze(['READ']),

  // ── Navigation ──────────────────────────────────────────────────────────────
  Nav:        Object.freeze(['READ']),
  NavBrand:   Object.freeze(['CLICK', 'NAVIGATE']),
  NavMenu:    Object.freeze(['READ']),
  NavItem:    Object.freeze(['CLICK', 'NAVIGATE']),
  Breadcrumb: Object.freeze(['READ']),
  Tab:        Object.freeze(['CLICK', 'READ']),
  Tabs:       Object.freeze(['READ']),

  // ── Layout containers ───────────────────────────────────────────────────────
  Page:       Object.freeze(['READ', 'SCROLL']),
  Section:    Object.freeze(['READ', 'SCROLL']),
  Main:       Object.freeze(['READ', 'SCROLL']),
  Aside:      Object.freeze(['READ', 'SCROLL']),
  Header:     Object.freeze(['READ']),
  Footer:     Object.freeze(['READ']),
  Article:    Object.freeze(['READ', 'SCROLL']),
  Card:       Object.freeze(['READ', 'CLICK']),
  CardHeader: Object.freeze(['READ']),
  CardBody:   Object.freeze(['READ']),
  CardFooter: Object.freeze(['READ']),
  Flex:       Object.freeze(['READ']),
  Grid:       Object.freeze(['READ']),

  // ── Typography ──────────────────────────────────────────────────────────────
  Text:  Object.freeze(['READ']),
  Badge: Object.freeze(['READ']),
  Tag:   Object.freeze(['READ', 'REMOVE']),

  // ── Lists ───────────────────────────────────────────────────────────────────
  List: Object.freeze(['READ']),
  Item: Object.freeze(['READ', 'CLICK']),

  // ── Tables ──────────────────────────────────────────────────────────────────
  Table:   Object.freeze(['READ', 'SORT', 'FILTER']),
  Columns: Object.freeze(['READ']),
  Column:  Object.freeze(['READ', 'SORT']),
  Rows:    Object.freeze(['READ']),
  Row:     Object.freeze(['READ', 'CLICK', 'SELECT']),
  Cell:    Object.freeze(['READ']),

  // ── Misc ────────────────────────────────────────────────────────────────────
  Divider: Object.freeze(['READ']),
  Spacer:  Object.freeze(['READ']),
});

/**
 * Returns the list of action tokens for a given SEAL element type.
 * Falls back to `['READ']` for any unknown type so callers always receive
 * a non-empty array.
 *
 * @param {string} elementType - A SEAL element type name (e.g. `"Button"`).
 * @returns {readonly string[]} Array of action token strings.
 */
function getActions(elementType) {
  return ACTION_MAP[elementType] ?? Object.freeze(['READ']);
}

/**
 * Serialises action tokens into the format expected by `data-seal-actions`.
 *
 * @param {string} elementType - A SEAL element type name.
 * @returns {string} Comma-separated action tokens, e.g. `"FILL,CLEAR,FOCUS"`.
 */
function serializeActions(elementType) {
  return getActions(elementType).join(',');
}

module.exports = { ACTION_MAP, getActions, serializeActions };

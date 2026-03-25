# SEAL Language Specification
## Version 0.1.0

**Semantic and Action Language (SEAL)** is a markup language designed for dual-audience rendering:
- **Human users** receive beautifully styled HTML.
- **AI agents** receive a structured, predictable, action-oriented representation of page content.

SEAL is whitespace-significant, indentation-based, and compiles to HTML + a machine-readable action protocol.

---

## Table of Contents

1. [Philosophy](#1-philosophy)
2. [Document Structure](#2-document-structure)
3. [Syntax Rules](#3-syntax-rules)
4. [Element Reference](#4-element-reference)
5. [Attributes](#5-attributes)
6. [Style Token System](#6-style-token-system)
7. [Data Binding](#7-data-binding)
8. [Directives](#8-directives)
9. [Metadata & Configuration Blocks](#9-metadata--configuration-blocks)
10. [Action Protocol](#10-action-protocol)
11. [Comments](#11-comments)
12. [Full Examples](#12-full-examples)
13. [Grammar (EBNF)](#13-grammar-ebnf)

---

## 1. Philosophy

SEAL addresses a fundamental tension in modern web development: HTML is rich enough to be rendered beautifully, but too ambiguous for AI agents to reliably interpret and act upon. SEAL solves this by:

- **Semantic roles** — every element declares its purpose, not just its presentation.
- **Explicit action affordances** — interactive elements carry machine-readable action metadata.
- **Single source of truth** — one `.seal` file produces both the HTML render and the AI action graph.
- **No runtime dependencies** — SEAL compiles to plain HTML/CSS/JS.

---

## 2. Document Structure

A SEAL document is a UTF-8 text file with the extension `.seal`.

```
Page #page-id title="Page Title" route="/path"
  @meta ...
  @theme ...
  @state ...
  @viewport ...

  Body
    ...content...
```

Every SEAL document **must** begin with a `Page` element at indent level 0. All other content is nested within `Body` (also at indent level 1). Configuration directives (`@meta`, `@theme`, `@state`, `@viewport`) appear between `Page` and `Body`.

### Document Sections

| Block       | Purpose                                      |
|-------------|----------------------------------------------|
| `Page`      | Root element, carries route and title        |
| `@meta`     | SEO and document metadata                   |
| `@theme`    | Design token overrides                      |
| `@state`    | Initial reactive state declarations         |
| `@viewport` | Viewport/breakpoint configuration            |
| `Body`      | All visible content                          |

---

## 3. Syntax Rules

### 3.1 Indentation

- **2 spaces per indent level** (tabs are not allowed).
- Child elements are indented exactly 2 spaces relative to their parent.
- Inconsistent indentation is a parse error.

```seal
Section                   // level 1
  Card                    // level 2
    Text "Hello"          // level 3
```

### 3.2 Element Declaration Line

The full syntax for a single element line is:

```
ElementType[#id][.role] [variant] [[attr=value ...]] ["inline text"]
```

All parts after `ElementType` are optional. Order matters:
1. `ElementType` — **required**, PascalCase.
2. `#id` — optional, CSS-style ID (alphanumeric and hyphens, attached to type with no space).
3. `.role` — optional, ARIA/semantic role (attached to `#id` or `ElementType` with no space).
4. `variant` — optional, a single bare token representing the visual variant.
5. `[attr=value ...]` — optional, square-bracketed attribute list.
6. `"inline text"` — optional, quoted string as the element's text content.

### 3.3 Identifier Rules

| Identifier | Format                   | Example                |
|------------|--------------------------|------------------------|
| `#id`      | `#[a-z][a-z0-9\-]*`      | `#login-form`          |
| `.role`    | `\.[a-z][a-z0-9\-]*`     | `.navigation`          |
| `variant`  | `[a-z][a-z0-9\-]*`       | `primary`, `elevated`  |

### 3.4 Attribute Syntax

Attributes appear inside square brackets, space-separated:

```seal
Input [type=email required placeholder="your@email.com"]
```

- **Unquoted values**: `key=value` — value is a token (no spaces).
- **Quoted values**: `key="string value"` — value may contain spaces.
- **Boolean flags**: bare `required` is equivalent to `required=true`.
- **Numeric values**: `gap=8` — parsed as numbers when unquoted and numeric.

### 3.5 Inline Text

A quoted string at the end of an element line sets its text content:

```seal
Button #submit variant=primary "Sign In"
Text variant=heading-1 "Welcome Back"
```

Inline text may contain interpolation expressions (see §7.2).

### 3.6 Block Text

Multi-line text content uses an indented block under the element with a `|` prefix per line:

```seal
Text variant=body
  | This is the first line.
  | This is the second line.
```

### 3.7 Children vs Inline Text

An element may have **either** inline text **or** children, not both. Children are the next indented block; inline text is the quoted string on the same line.

---

## 4. Element Reference

### 4.1 Layout Elements

| Element     | HTML Output       | Description                              |
|-------------|-------------------|------------------------------------------|
| `Page`      | `<html>`          | Root document element                    |
| `Body`      | `<body>`          | Document body                            |
| `Section`   | `<section>`       | Logical content section                  |
| `Article`   | `<article>`       | Self-contained article content           |
| `Aside`     | `<aside>`         | Secondary/sidebar content                |
| `Header`    | `<header>`        | Section or page header                   |
| `Footer`    | `<footer>`        | Section or page footer                   |
| `Nav`       | `<nav>`           | Navigation container                     |
| `Main`      | `<main>`          | Primary page content                     |
| `Flex`      | `<div>`           | Flexbox container (sets `display:flex`)  |
| `Grid`      | `<div>`           | CSS Grid container                       |
| `Stack`     | `<div>`           | Vertical flex stack                      |
| `Row`       | `<div>`           | Horizontal flex row                      |
| `Col`       | `<div>`           | Grid column                              |
| `Container` | `<div>`           | Max-width centered container             |
| `Divider`   | `<hr>`            | Visual/semantic divider                  |
| `Spacer`    | `<div>`           | Blank spacing element                    |

### 4.2 Content Elements

| Element       | HTML Output         | Description                            |
|---------------|---------------------|----------------------------------------|
| `Text`        | `<p>` or `<span>`   | General text; variant selects tag      |
| `Heading`     | `<h1>`–`<h6>`       | Heading; level from variant            |
| `Label`       | `<label>`           | Form label                             |
| `Paragraph`   | `<p>`               | Explicit paragraph                     |
| `Span`        | `<span>`            | Inline text container                  |
| `Strong`      | `<strong>`          | Bold/important text                    |
| `Em`          | `<em>`              | Italic/emphasized text                 |
| `Code`        | `<code>`            | Inline code                            |
| `Pre`         | `<pre>`             | Preformatted text block                |
| `Blockquote`  | `<blockquote>`      | Block quotation                        |
| `List`        | `<ul>` or `<ol>`    | List container; variant selects type   |
| `Item`        | `<li>`              | List item                              |
| `Image`       | `<img>`             | Image element                          |
| `Icon`        | `<svg>` / `<i>`     | Icon element                           |
| `Badge`       | `<span>`            | Small status badge                     |
| `Tag`         | `<span>`            | Pill/tag label                         |

### 4.3 Interactive Elements

| Element      | HTML Output          | Description                              |
|--------------|----------------------|------------------------------------------|
| `Button`     | `<button>`           | Clickable button                         |
| `Link`       | `<a>`                | Anchor/hyperlink                         |
| `Input`      | `<input>`            | Form input field                         |
| `Textarea`   | `<textarea>`         | Multi-line text input                    |
| `Select`     | `<select>`           | Dropdown select                          |
| `Option`     | `<option>`           | Select option                            |
| `Checkbox`   | `<input type=checkbox>` | Checkbox with label                  |
| `Radio`      | `<input type=radio>` | Radio button with label                  |
| `Toggle`     | `<input type=checkbox>` | Toggle switch (styled checkbox)       |
| `Slider`     | `<input type=range>` | Range slider                             |
| `DatePicker` | `<input type=date>`  | Date input                               |
| `FileUpload` | `<input type=file>`  | File upload input                        |
| `Form`       | `<form>`             | Form container                           |

### 4.4 Feedback Elements

| Element      | HTML Output    | Description                              |
|--------------|----------------|------------------------------------------|
| `Alert`      | `<div>`        | Status/feedback message box              |
| `Toast`      | `<div>`        | Temporary notification                   |
| `Modal`      | `<dialog>`     | Dialog/modal overlay                     |
| `Tooltip`    | `<span>`       | Hover tooltip                            |
| `Spinner`    | `<div>`        | Loading spinner                          |
| `Progress`   | `<progress>`   | Progress bar                             |
| `Skeleton`   | `<div>`        | Loading skeleton placeholder             |

### 4.5 Composite/Card Elements

| Element      | HTML Output    | Description                              |
|--------------|----------------|------------------------------------------|
| `Card`       | `<div>`        | Card container with shadow/border        |
| `Panel`      | `<div>`        | Content panel                            |
| `Accordion`  | `<details>`    | Collapsible accordion panel              |
| `Tab`        | `<div>`        | Tab container                            |
| `TabPanel`   | `<div>`        | Individual tab content                   |
| `Table`      | `<table>`      | Data table                               |
| `TableRow`   | `<tr>`         | Table row                                |
| `TableCell`  | `<td>`         | Table data cell                          |
| `TableHead`  | `<th>`         | Table header cell                        |

### 4.6 Navigation Elements

| Element      | HTML Output    | Description                              |
|--------------|----------------|------------------------------------------|
| `Navbar`     | `<nav>`        | Top navigation bar                       |
| `Sidebar`    | `<aside>`      | Side navigation panel                    |
| `Breadcrumb` | `<nav>`        | Breadcrumb trail                         |
| `Pagination` | `<nav>`        | Page pagination control                  |
| `Menu`       | `<ul>`         | Dropdown/context menu                    |
| `MenuItem`   | `<li>`         | Menu item                                |

---

## 5. Attributes

### 5.1 Universal Attributes

These attributes apply to all elements:

| Attribute    | Type     | Description                                  |
|--------------|----------|----------------------------------------------|
| `id`         | string   | Unique element identifier (also via `#id`)   |
| `class`      | string   | Additional CSS classes                       |
| `aria-label` | string   | ARIA label for accessibility                 |
| `aria-role`  | string   | ARIA role override                           |
| `hidden`     | boolean  | Hide element from render                     |
| `disabled`   | boolean  | Disable interaction                          |
| `tabindex`   | number   | Tab order index                              |
| `data-*`     | string   | Custom data attributes                       |
| `style`      | string   | Inline CSS (discouraged; use `@style` block) |

### 5.2 Layout Attributes

| Attribute    | Applies To         | Values                                       |
|--------------|--------------------|----------------------------------------------|
| `direction`  | Flex, Row, Stack   | `row`, `col`, `row-reverse`, `col-reverse`   |
| `align`      | Flex, Grid         | `start`, `center`, `end`, `stretch`          |
| `justify`    | Flex, Grid         | `start`, `center`, `end`, `between`, `around`|
| `gap`        | Flex, Grid, Stack  | size token or number (px)                    |
| `wrap`       | Flex               | `wrap`, `nowrap`, `wrap-reverse`             |
| `cols`       | Grid               | number or template string                    |
| `rows`       | Grid               | number or template string                    |
| `span`       | Col                | number of columns to span                    |
| `padding`    | any                | size token or CSS value                      |
| `margin`     | any                | size token or CSS value                      |
| `width`      | any                | size token, percentage, or CSS value         |
| `height`     | any                | size token, percentage, or CSS value         |
| `overflow`   | any                | `visible`, `hidden`, `scroll`, `auto`        |

### 5.3 Text Attributes

| Attribute    | Applies To          | Values                                      |
|--------------|---------------------|---------------------------------------------|
| `color`      | Text, Heading, Span | color token or hex/rgb value                |
| `align`      | Text, Heading       | `left`, `center`, `right`, `justify`        |
| `weight`     | Text, Span          | `thin`, `light`, `normal`, `medium`, `bold` |
| `size`       | Text, Span          | size token or CSS font-size                 |
| `truncate`   | Text                | boolean — single line with ellipsis         |
| `lines`      | Text                | number — max lines with ellipsis            |
| `nowrap`     | Text, Span          | boolean — prevent wrapping                  |
| `transform`  | Text, Span          | `uppercase`, `lowercase`, `capitalize`      |

### 5.4 Interactive Element Attributes

#### Button

| Attribute    | Type     | Description                                   |
|--------------|----------|-----------------------------------------------|
| `type`       | string   | `button` (default), `submit`, `reset`         |
| `submit`     | boolean  | Shorthand for `type=submit`                   |
| `disabled`   | boolean  | Disable button                                |
| `loading`    | boolean  | Show loading state                            |
| `action`     | string   | AI action identifier                          |
| `href`       | string   | Render as link-button navigating to URL       |

#### Input

| Attribute     | Type     | Description                                  |
|---------------|----------|----------------------------------------------|
| `type`        | string   | `text`, `email`, `password`, `number`, etc.  |
| `label`       | string   | Visible label text                           |
| `placeholder` | string   | Placeholder text                             |
| `required`    | boolean  | Field is required                            |
| `disabled`    | boolean  | Field is disabled                            |
| `readonly`    | boolean  | Field is read-only                           |
| `value`       | string   | Initial/bound value                          |
| `min`         | number   | Minimum value (number inputs)                |
| `max`         | number   | Maximum value (number inputs)                |
| `step`        | number   | Step value (number/range inputs)             |
| `pattern`     | string   | Validation regex pattern                     |
| `autocomplete`| string   | Browser autocomplete hint                    |
| `bind`        | string   | State variable to bind (`$varName`)          |

#### Form

| Attribute    | Type     | Description                                    |
|--------------|----------|------------------------------------------------|
| `action`     | string   | Form submission URL                            |
| `method`     | string   | `GET` or `POST`                                |
| `validate`   | boolean  | Enable client-side validation                  |
| `enctype`    | string   | Encoding type (`multipart/form-data`, etc.)    |

#### Link

| Attribute    | Type     | Description                                    |
|--------------|----------|------------------------------------------------|
| `href`       | string   | Destination URL — **required**                 |
| `target`     | string   | `_blank`, `_self`, `_parent`, `_top`           |
| `rel`        | string   | Link relationship (`noopener`, `noreferrer`)   |
| `download`   | boolean  | Trigger file download                          |

#### Image

| Attribute    | Type     | Description                                    |
|--------------|----------|------------------------------------------------|
| `src`        | string   | Image URL — **required**                       |
| `alt`        | string   | Accessible alt text — **required**             |
| `width`      | number   | Image width in px                              |
| `height`     | number   | Image height in px                             |
| `loading`    | string   | `lazy` or `eager`                              |
| `fit`        | string   | `cover`, `contain`, `fill`, `none`             |

#### Select / Option

| Attribute    | Type     | Description                                    |
|--------------|----------|------------------------------------------------|
| `label`      | string   | Visible label for Select                       |
| `multiple`   | boolean  | Allow multiple selection                       |
| `value`      | string   | Initial selected value                         |
| `bind`       | string   | State binding                                  |

---

## 6. Style Token System

SEAL uses a token system to express design intent without raw CSS values. Tokens compile to CSS custom properties.

### 6.1 Variant Tokens

Variant tokens express semantic roles for color and emphasis:

| Token        | Meaning                                     | Maps to CSS class     |
|--------------|---------------------------------------------|-----------------------|
| `primary`    | Primary brand action                        | `.seal-primary`       |
| `secondary`  | Secondary action                            | `.seal-secondary`     |
| `success`    | Positive/success state                      | `.seal-success`       |
| `danger`     | Error/destructive action                    | `.seal-danger`        |
| `warning`    | Cautionary state                            | `.seal-warning`       |
| `info`       | Informational state                         | `.seal-info`          |
| `muted`      | Subdued, low-emphasis                       | `.seal-muted`         |
| `ghost`      | Transparent/outline style                   | `.seal-ghost`         |
| `outline`    | Border-only style                           | `.seal-outline`       |
| `elevated`   | Raised card with shadow                     | `.seal-elevated`      |
| `flat`       | No shadow, minimal border                   | `.seal-flat`          |
| `centered`   | Centered layout                             | `.seal-centered`      |

### 6.2 Size Tokens

| Token   | Value    | CSS Custom Property     |
|---------|----------|-------------------------|
| `xs`    | 4px      | `--seal-space-xs`       |
| `sm`    | 8px      | `--seal-space-sm`       |
| `md`    | 16px     | `--seal-space-md`       |
| `lg`    | 24px     | `--seal-space-lg`       |
| `xl`    | 32px     | `--seal-space-xl`       |
| `2xl`   | 48px     | `--seal-space-2xl`      |
| `3xl`   | 64px     | `--seal-space-3xl`      |
| `full`  | 100%     | —                       |
| `auto`  | auto     | —                       |

### 6.3 Text Variant Tokens

When used on `Text` elements, these variants determine the HTML tag and base styles:

| Token        | HTML Tag   | CSS Class              |
|--------------|------------|------------------------|
| `heading-1`  | `<h1>`     | `.seal-h1`             |
| `heading-2`  | `<h2>`     | `.seal-h2`             |
| `heading-3`  | `<h3>`     | `.seal-h3`             |
| `heading-4`  | `<h4>`     | `.seal-h4`             |
| `heading-5`  | `<h5>`     | `.seal-h5`             |
| `heading-6`  | `<h6>`     | `.seal-h6`             |
| `body`       | `<p>`      | `.seal-body`           |
| `body-sm`    | `<p>`      | `.seal-body-sm`        |
| `body-lg`    | `<p>`      | `.seal-body-lg`        |
| `caption`    | `<span>`   | `.seal-caption`        |
| `overline`   | `<span>`   | `.seal-overline`       |
| `code`       | `<code>`   | `.seal-code`           |
| `label`      | `<label>`  | `.seal-label`          |

### 6.4 Layout Tokens

| Token      | Applies to              | Effect                            |
|------------|-------------------------|-----------------------------------|
| `centered` | Section, Container      | Centers content horizontally      |
| `fluid`    | Container               | Full-width, no max-width cap      |
| `sticky`   | Header, Navbar          | `position: sticky; top: 0`        |
| `fixed`    | Navbar, Sidebar         | `position: fixed`                 |

### 6.5 Color Tokens

Color tokens resolve via the `@theme` block or default palette:

```seal
@theme
  primary: #3b82f6
  primary-dark: #2563eb
  secondary: #6b7280
  success: #10b981
  danger: #ef4444
  warning: #f59e0b
  info: #06b6d4
  background: #ffffff
  surface: #f9fafb
  border: #e5e7eb
  text: #111827
  text-muted: #6b7280
```

### 6.6 Inline @style Block

Any element may have an `@style` block child that applies scoped CSS:

```seal
Card #hero elevated
  @style
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)
    border-radius: 16px
    min-height: 400px
  Text variant=heading-1 "Hello"
```

The `@style` block uses plain CSS property syntax (no selectors needed). Properties are scoped to the parent element.

---

## 7. Data Binding

### 7.1 State Variables

State variables are declared in the `@state` block and referenced with `$` prefix:

```seal
@state
  user: null
  isLoggedIn: false
  count: 0
  items: []
  loginError: ""
```

### 7.2 Interpolation

State variables are interpolated inside double-curly braces within quoted strings:

```seal
Text "Welcome, {$user.name}!"
Text "You have {$count} items in your cart."
```

Or as standalone quoted interpolation (the entire text content is the expression):

```seal
Alert variant=danger [if $loginError]
  "$loginError"
```

### 7.3 Attribute Binding

State variables can be bound to attributes using the `$` prefix:

```seal
Button [disabled=$isSubmitting] "Submit"
Image [src=$user.avatar] [alt=$user.name]
```

### 7.4 Two-Way Binding

The `bind` attribute creates two-way state binding for inputs:

```seal
Input #name [bind=$formName type=text label="Full Name"]
```

### 7.5 Computed Expressions

Simple expressions are supported in interpolation and attribute bindings:

```seal
Text "{$count} item{$count !== 1 ? 's' : ''}"
Button [disabled=$items.length === 0] "Checkout"
```

---

## 8. Directives

Directives appear in square brackets on the same line as the element, after the attribute block.

### 8.1 Conditional Rendering

```seal
Alert variant=danger [if $error]
  "$error"

Button #pro-feature [unless $isPremium] "Upgrade to use this"
```

- `[if $expression]` — renders the element only when the expression is truthy.
- `[unless $expression]` — renders when the expression is falsy.

### 8.2 List Rendering

```seal
List
  Item [each product in $products]
    Text "{$product.name}"
    Text variant=body-sm color=muted "{$product.price}"
```

- `[each item in $list]` — repeats the element for each item in the list.
- The loop variable (`item`) is scoped to the element and its children.
- `$index` is available automatically within `[each]` blocks.

### 8.3 Multiple Directives

Multiple directives may be combined on one line:

```seal
Item [each item in $items] [if $item.visible]
  Text "{$item.label}"
```

Directives are evaluated in order: `[each]` first, then `[if]`/`[unless]` per iteration.

### 8.4 Directive Reference

| Directive               | Description                                     |
|-------------------------|-------------------------------------------------|
| `[if $expr]`            | Show if expression is truthy                    |
| `[unless $expr]`        | Show if expression is falsy                     |
| `[each item in $list]`  | Repeat for each item in list                    |
| `[ref=$varName]`        | Assign element reference to state variable      |
| `[key=$expr]`           | Keyed list rendering (performance hint)         |

---

## 9. Metadata & Configuration Blocks

Configuration blocks are prefixed with `@` and appear at the top of the document (before `Body`) or as children of specific elements.

### 9.1 @meta

```seal
@meta
  description: "Sign in to your account"
  keywords: "login, auth, sign in"
  og:title: "Login — MyApp"
  og:image: "https://myapp.com/og-login.png"
  robots: "noindex"
```

Compiles to `<meta>` tags in `<head>`.

### 9.2 @theme

```seal
@theme
  primary: #3b82f6
  font-family: "Inter, system-ui, sans-serif"
  border-radius: 8px
```

Compiles to CSS custom properties on `:root`.

### 9.3 @state

```seal
@state
  user: null
  count: 0
  items: []
  isOpen: false
```

Values are JSON-compatible initializers. Compiles to a JavaScript state object.

### 9.4 @viewport

```seal
@viewport
  default: mobile
  breakpoints:
    sm: 640px
    md: 768px
    lg: 1024px
    xl: 1280px
```

Configures responsive breakpoints.

### 9.5 @style (Scoped)

As described in §6.6, `@style` can appear as a child of any element to apply scoped CSS:

```seal
Section #hero
  @style
    padding: 80px 0
    background: #f8fafc
```

### 9.6 @script

Inline JavaScript for event handlers and computed values:

```seal
Button #counter-btn
  @script
    onClick: () => $count++
```

---

## 10. Action Protocol

The Action Protocol is the machine-readable layer of SEAL. When an AI agent reads a compiled SEAL page, it receives an action graph describing every interaction available.

### 10.1 Action Types

| Action     | Target Elements         | Description                                   |
|------------|-------------------------|-----------------------------------------------|
| `FILL`     | Input, Textarea         | Fill a text input with a value                |
| `CLICK`    | Button, Link, any       | Click/activate an element                     |
| `NAVIGATE` | Link, Button[href]      | Navigate to a URL                             |
| `SELECT`   | Select, Radio, Option   | Select an option from a list                  |
| `CHECK`    | Checkbox, Toggle        | Check/uncheck a checkbox                      |
| `SUBMIT`   | Form, Button[submit]    | Submit a form                                 |
| `SCROLL`   | any scrollable          | Scroll to or within an element                |
| `FOCUS`    | any focusable           | Set keyboard focus to an element              |
| `UPLOAD`   | FileUpload              | Upload a file                                 |
| `CLEAR`    | Input, Textarea         | Clear the content of an input                 |
| `HOVER`    | any                     | Hover over an element (trigger tooltip, etc.) |
| `DISMISS`  | Modal, Alert, Toast     | Close/dismiss a popup or notification         |
| `EXPAND`   | Accordion, Tab          | Open/expand a collapsible element             |
| `COLLAPSE` | Accordion, Tab          | Close/collapse an element                     |

### 10.2 Action Schema

Each action in the protocol has the following structure:

```json
{
  "action": "FILL",
  "target": "#email",
  "targetType": "Input",
  "label": "Email Address",
  "value": "<agent-provided>",
  "required": true,
  "validation": {
    "type": "email",
    "pattern": null
  }
}
```

### 10.3 Action Protocol Output Format

The compiled action protocol is a JSON structure:

```json
{
  "route": "/login",
  "title": "Login",
  "description": "Sign in to your account",
  "actions": [
    {
      "action": "FILL",
      "target": "#email",
      "targetType": "Input",
      "label": "Email Address",
      "required": true,
      "validation": { "type": "email" }
    },
    {
      "action": "FILL",
      "target": "#password",
      "targetType": "Input",
      "label": "Password",
      "required": true,
      "validation": { "type": "password" }
    },
    {
      "action": "CHECK",
      "target": "#remember",
      "targetType": "Checkbox",
      "label": "Remember me",
      "required": false
    },
    {
      "action": "SUBMIT",
      "target": "#login-form",
      "targetType": "Form",
      "method": "POST",
      "endpoint": "/api/auth/login"
    }
  ],
  "navigation": [
    {
      "action": "NAVIGATE",
      "target": "#forgot",
      "label": "Forgot password?",
      "href": "/forgot"
    },
    {
      "action": "NAVIGATE",
      "target": "#signup",
      "label": "Sign up",
      "href": "/signup"
    }
  ]
}
```

### 10.4 Action Chaining

Actions can declare prerequisites (for AI orchestration):

```seal
Button #submit [after=#email #password] "Sign In"
```

This signals to the AI agent that the submit action should only be taken after the email and password fields are filled.

### 10.5 AI Annotations

Elements can carry explicit AI instructions using `@ai` annotations:

```seal
Input #search
  @ai
    hint: "Search for products by name, category, or SKU"
    example: "blue running shoes"
```

---

## 11. Comments

### 11.1 Single-Line Comments

```seal
// This is a single-line comment
Section #main  // Inline comment after element
```

Comments run to the end of the line and are stripped before parsing.

### 11.2 Multi-Line Comments

```seal
/*
  This is a multi-line comment.
  It can span several lines.
*/
Section #main
```

### 11.3 Doc Comments

Doc comments use `///` and attach metadata to the following element:

```seal
/// The primary login form. Contains email, password, and submit button.
/// @action SUBMIT endpoint=/api/auth/login
Form #login-form
```

Doc comments are preserved in the AST and emitted in the action protocol.

---

## 12. Full Examples

### 12.1 Login Page

```seal
// Login page
Page #login-page title="Login" route="/login"
  @meta
    description: "Sign in to your account"

  @theme
    primary: #3b82f6

  @state
    loginError: ""
    isSubmitting: false

  Body
    Section #login-section variant=centered
      Card #login-card variant=elevated
        Header
          Text variant=heading-1 "Welcome Back"
          Text variant=body color=muted "Sign in to continue"

        Form #login-form action="/api/auth/login" method=POST validate=true
          Input #email type=email label="Email Address" required placeholder="you@example.com"
          Input #password type=password label="Password" required

          Flex direction=row align=center justify=between
            Checkbox #remember label="Remember me"
            Link #forgot href="/forgot" "Forgot password?"

          Button #submit variant=primary submit=true [disabled=$isSubmitting] "Sign In"

          Alert #error-alert variant=danger [if $loginError]
            "$loginError"

        Divider

        Flex direction=row gap=sm justify=center
          Text variant=body color=muted "Don't have an account?"
          Link #signup href="/signup" "Sign up"
```

### 12.2 Dashboard Page

```seal
Page #dashboard title="Dashboard" route="/dashboard"
  @meta
    description: "Your personal dashboard"

  @state
    user: null
    stats: { revenue: 0, orders: 0, customers: 0 }
    recentOrders: []
    isLoading: true

  Body
    Navbar sticky
      Container
        Flex align=center justify=between
          Image src="/logo.svg" alt="Logo" height=32
          Nav
            Link href="/dashboard" "Dashboard"
            Link href="/orders" "Orders"
            Link href="/customers" "Customers"
          Flex align=center gap=sm
            Icon name=bell
            Image #avatar [src=$user.avatar] alt="Profile" width=32 height=32

    Main
      Container
        Stack gap=lg
          // Page heading
          Flex justify=between align=center
            Heading variant=heading-2 "Dashboard"
            Button variant=primary "New Order"

          // Stat cards
          Grid cols=3 gap=md
            Card #revenue-card variant=elevated
              Text variant=overline color=muted "REVENUE"
              Text variant=heading-2 "{$stats.revenue}"
              Badge variant=success "+12% this month"

            Card #orders-card variant=elevated
              Text variant=overline color=muted "ORDERS"
              Text variant=heading-2 "{$stats.orders}"
              Badge variant=info "+8 today"

            Card #customers-card variant=elevated
              Text variant=overline color=muted "CUSTOMERS"
              Text variant=heading-2 "{$stats.customers}"
              Badge variant=warning "3 new"

          // Recent orders table
          Card variant=flat
            Header
              Text variant=heading-3 "Recent Orders"

            Table #orders-table
              TableRow
                TableHead "Order ID"
                TableHead "Customer"
                TableHead "Amount"
                TableHead "Status"
              TableRow [each order in $recentOrders]
                TableCell "{$order.id}"
                TableCell "{$order.customer}"
                TableCell "{$order.amount}"
                TableCell
                  Badge [variant=$order.statusVariant] "{$order.status}"

          Spinner [if $isLoading]
```

### 12.3 Registration Form

```seal
Page #register-page title="Create Account" route="/register"
  @state
    formData:
      name: ""
      email: ""
      password: ""
      confirmPassword: ""
      agreeToTerms: false
    errors: {}
    isSubmitting: false

  Body
    Section centered
      Card elevated
        Header
          Text variant=heading-1 "Create an Account"
          Text variant=body color=muted "Get started for free today"

        Form #register-form action="/api/auth/register" method=POST validate=true
          Grid cols=2 gap=md
            Input #first-name [bind=$formData.firstName type=text label="First Name" required]
            Input #last-name [bind=$formData.lastName type=text label="Last Name" required]

          Input #email [bind=$formData.email type=email label="Email Address" required]

          Input #password [bind=$formData.password type=password label="Password" required]
            @ai
              hint: "Password must be at least 8 characters"

          Input #confirm-password [bind=$formData.confirmPassword type=password label="Confirm Password" required]

          Select #country label="Country" required
            Option value="" "Select your country"
            Option value="us" "United States"
            Option value="gb" "United Kingdom"
            Option value="ca" "Canada"
            Option value="au" "Australia"

          Checkbox #terms [bind=$formData.agreeToTerms required]
            Text variant=body-sm
              | I agree to the
              Link href="/terms" "Terms of Service"
              | and
              Link href="/privacy" "Privacy Policy"

          Button #submit variant=primary submit=true [disabled=$isSubmitting] "Create Account"

          Alert variant=danger [if $errors.general]
            "{$errors.general}"
```

### 12.4 Product Listing Page

```seal
Page #products-page title="Products" route="/products"
  @state
    products: []
    searchQuery: ""
    selectedCategory: "all"
    isLoading: false
    currentPage: 1

  Body
    Container
      Stack gap=lg
        Flex justify=between align=center
          Heading variant=heading-2 "Products"
          Flex gap=sm
            Input #search [bind=$searchQuery placeholder="Search products..." type=search]
            Select #category [bind=$selectedCategory]
              Option value="all" "All Categories"
              Option value="electronics" "Electronics"
              Option value="clothing" "Clothing"
              Option value="books" "Books"

        Spinner [if $isLoading]

        Grid cols=4 gap=md [unless $isLoading]
          Card [each product in $products] variant=elevated
            Image [src=$product.image] [alt=$product.name] fit=cover height=200
            Stack gap=sm padding=md
              Text variant=heading-4 "{$product.name}"
              Text variant=body-sm color=muted "{$product.category}"
              Flex justify=between align=center
                Text variant=heading-3 "{$product.price}"
                Button variant=primary "Add to Cart"

        Pagination
          Button [disabled=$currentPage === 1] "Previous"
          Text "Page {$currentPage}"
          Button "Next"
```

---

## 13. Grammar (EBNF)

```ebnf
document       ::= page_decl config_blocks? body

page_decl      ::= "Page" element_suffix NEWLINE

body           ::= INDENT "Body" NEWLINE block DEDENT

block          ::= (element | comment)*

element        ::= INDENT element_line NEWLINE (block | text_block)?

element_line   ::= element_type selector? variant? attr_block? inline_text? directive*

element_type   ::= PASCAL_WORD

selector       ::= id_selector role_selector?
                 | role_selector

id_selector    ::= "#" IDENTIFIER

role_selector  ::= "." IDENTIFIER

variant        ::= IDENTIFIER   (* bare word after selector, before attr_block *)

attr_block     ::= "[" attr_pair+ "]"

attr_pair      ::= IDENTIFIER "=" attr_value
                 | IDENTIFIER          (* boolean true *)

attr_value     ::= QUOTED_STRING
                 | IDENTIFIER
                 | NUMBER
                 | "$" IDENTIFIER      (* state binding *)

inline_text    ::= QUOTED_STRING

text_block     ::= (INDENT "|" TEXT NEWLINE)+

directive      ::= "[" directive_body "]"

directive_body ::= "if" expr
                 | "unless" expr
                 | "each" IDENTIFIER "in" "$" IDENTIFIER
                 | "ref" "=" "$" IDENTIFIER
                 | "key" "=" expr
                 | "after" "=" id_ref+

expr           ::= "$" IDENTIFIER ("." IDENTIFIER)*
                 | expr BINARY_OP expr
                 | "!" expr

config_blocks  ::= config_block+

config_block   ::= INDENT "@" config_type NEWLINE config_body

config_type    ::= "meta" | "theme" | "state" | "viewport" | "style" | "script" | "ai"

config_body    ::= (INDENT property_line NEWLINE)+

property_line  ::= IDENTIFIER ":" value

comment        ::= "//" TEXT NEWLINE
                 | "/*" TEXT* "*/"
                 | "///" TEXT NEWLINE   (* doc comment *)

PASCAL_WORD    ::= [A-Z][a-zA-Z0-9]*
IDENTIFIER     ::= [a-z_][a-z0-9_\-]*
QUOTED_STRING  ::= '"' [^"]* '"'
NUMBER         ::= [0-9]+(\.[0-9]+)?
NEWLINE        ::= "\n" | "\r\n"
INDENT         ::= "  " (* exactly 2 spaces per level *)
```

---

*End of SEAL Language Specification v0.1.0*

# SEAL (Semantic and Action Language) 🦭

**The Markup Language for the AI Era.**

SEAL is a whitespace-significant DSL designed to bridge the gap between human-readable UI and machine-actionable protocols. It compiles to beautiful, modern HTML and a structured AI Action Manifest.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)]()

## Why SEAL?

Modern web development focuses on human users, but AI agents struggle to interact with messy HTML. SEAL solves this by making **Semantic Roles** and **Action Affordances** first-class citizens.

- **Human-Centric:** Clean, indentation-based syntax. No more `< >` tag soup.
- **AI-Native:** Automatically generates a manifest of what AI can do (FILL, CLICK, SELECT).
- **Pro-grade UI:** Comes with a built-in "SaaS-ready" design system.
- **Protocol-First:** Includes an interpreter to turn natural language into browser automation scripts.

## Installation

```bash
npm install seal-lang
```

## Quick Example

Write your UI in `.seal`:

```seal
Page #login title="Login"
  Body
    Card elevated
      Heading variant=heading-2 "Welcome"
      Form #login-form
        Input #email type=email label="Email"
        Button #submit primary "Sign In"
```

Compile it:

```javascript
const seal = require('seal-lang');
const { html, manifest } = seal.render(seal.parse(source));
```

## License

MIT © 2026 SEAL Language Project

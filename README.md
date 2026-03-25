# SEAL Language (Semantic and Action Language) 🦭

**The Markup Language for the AI Era.**  
*Human-Readable Layout. Machine-Actionable Protocol.*

[![npm version](https://img.shields.io/npm/v/seal-lang.svg?style=flat-square)](https://www.npmjs.com/package/seal-lang)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)

---

## 🌐 Live Demo & Studio
Try the **SEAL Studio** online: [**seal-site.pages.dev**](https://seal-site.pages.dev/studio.html)  
Build, preview, and generate AI-ready manifests instantly in your browser.

---

## ✨ What is SEAL?

SEAL is a whitespace-significant Domain Specific Language (DSL) designed to bridge the gap between human users and AI agents. It replaces messy HTML "tag soup" with a clean, indentation-based syntax that compiles into:

1.  **Beautiful, Modern UI:** A production-ready SaaS design system built-in.
2.  **AI Action Manifest:** A structured JSON protocol describing every interactive element and how an AI can use it (e.g., `FILL`, `CLICK`, `SELECT`).
3.  **Automation Logic:** An interpreter that turns natural language (e.g., *"Login with email test@gmail.com"*) into executable browser commands.

---

## 🚀 Key Features

-   **🎯 Human-Centric:** Indentation-based syntax (like Python/Jade) for maximum readability.
-   **🤖 AI-Native:** First-class support for semantic roles and action affordances.
-   **🎨 Zero-Config Styling:** Professional-grade SaaS UI components right out of the box.
-   **🔌 Built-in Interpreter:** Translate English instructions into structured SEAL commands.
-   **📦 Zero Dependency:** Tiny footprint, works in the browser or Node.js.

---

## 📦 Installation

### As a Library
```bash
npm install seal-lang
```

### From CDN (Browser)
```html
<script src="https://unpkg.com/seal-lang@0.1.1/dist/seal.js"></script>
```

---

## 🛠 Usage

### 1. Define your UI (`main.seal`)
```seal
Page #home title="Dashboard"
  @theme brand=indigo radius=md
  Body
    Header
      Flex justify=between align=center
        Heading variant=heading-2 "Overview"
        Button #new-order variant=primary "New Order"
    
    Grid cols=3 gap=md
      Card elevated
        Text size=sm "Active Users"
        Heading "24.5k"
      
      Form #search-form
        Input #query label="Search" placeholder="Find orders..."
        Button #submit "Search"
```

### 2. Compile and Render
```javascript
const seal = require('seal-lang');

const source = `...`; // Your SEAL source
const ast = seal.parse(source);
const html = seal.render(ast);
const manifest = seal.manifest(ast);

console.log(manifest);
/* 
Output:
{
  "title": "Dashboard",
  "actions": [
    { "id": "new-order", "type": "Button", "actions": ["CLICK"] },
    { "id": "query", "type": "Input", "actions": ["FILL", "CLEAR"] },
    ...
  ]
}
*/
```

### 3. AI Interpretation
```javascript
const commands = seal.interpret("Login with email admin@test.com");
// → ["FILL #email WITH 'admin@test.com'", "CLICK #submit-btn"]
```

---

## 🏗 Project Structure

-   `src/`: Core parser, renderer, and AI protocol logic.
-   `dist/`: Compiled standalone browser bundles.
-   `spec/`: Formal SEAL language specifications.
-   `seal-site/`: The source for our [Live Studio](https://seal-site.pages.dev/).

---

## 🤝 Contributing

We welcome contributions! SEAL is an open-source project dedicated to making the web more accessible for AI.

1.  Fork the repo.
2.  Create your feature branch (`git checkout -b feature/amazing-feature`).
3.  Commit your changes (`git commit -m 'Add some amazing feature'`).
4.  Push to the branch (`git push origin feature/amazing-feature`).
5.  Open a Pull Request.

---

## 📄 License

MIT © 2026 SEAL Language Project. Distributed under the MIT License. See `LICENSE` for more information.

---

**Made with 🦭 for the future of AI-Web interaction.**

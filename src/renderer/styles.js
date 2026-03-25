/**
 * @fileoverview SEAL Base Stylesheet — Modern SaaS Edition
 *
 * Provides a professional, production-ready design system for SEAL.
 * Inspired by modern interfaces like Linear, Vercel, and Stripe.
 */

'use strict';

function getBaseStyles() {
  return /* css */`
:root {
  /* --- Colors (Slate & Indigo) --- */
  --primary: #6366f1;
  --primary-hover: #4f46e5;
  --primary-glow: rgba(99, 102, 241, 0.15);
  
  --success: #10b981;
  --danger: #ef4444;
  --warning: #f59e0b;
  --info: #3b82f6;

  /* --- Light Theme Neutrals --- */
  --bg: #ffffff;
  --bg-subtle: #f8fafc;
  --bg-card: #ffffff;
  --border: #e2e8f0;
  --border-hover: #cbd5e1;
  --text: #0f172a;
  --text-muted: #64748b;
  --text-subtle: #94a3b8;

  /* --- Typography --- */
  --font-sans: "Inter", system-ui, -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", monospace;

  /* --- Spacing & Radius --- */
  --radius-lg: 12px;
  --radius-md: 8px;
  --radius-sm: 4px;
  
  /* --- Shadows --- */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1);
  --shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.1);

  --transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #020617;
    --bg-subtle: #0f172a;
    --bg-card: #1e293b;
    --border: #334155;
    --border-hover: #475569;
    --text: #f8fafc;
    --text-muted: #94a3b8;
    --text-subtle: #64748b;
  }
}

/* --- Base --- */
* { box-sizing: border-box; margin: 0; padding: 0; }
body { 
  font-family: var(--font-sans); 
  background-color: var(--bg); 
  color: var(--text);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

/* --- Layout --- */
.seal-container { max-width: 1200px; margin: 0 auto; padding: 0 2rem; }
.seal-flex { display: flex; gap: 1rem; flex-wrap: wrap; }
.seal-flex[data-align="center"] { align-items: center; }
.seal-flex[data-justify="between"] { justify-content: space-between; }
.seal-stack { display: flex; flex-direction: column; gap: 1rem; }

/* --- Components --- */
.seal-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: 1.5rem;
  transition: var(--transition);
}
.seal-card:hover { border-color: var(--border-hover); box-shadow: var(--shadow-md); }

button, .seal-btn {
  padding: 0.6rem 1.2rem;
  border-radius: var(--radius-md);
  font-weight: 500;
  font-size: 0.875rem;
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text);
  cursor: pointer;
  transition: var(--transition);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

button[data-variant="primary"] { 
  background: var(--primary); 
  color: white; 
  border: none;
}
button[data-variant="primary"]:hover { 
  background: var(--primary-hover); 
  transform: translateY(-1px);
  box-shadow: 0 4px 12px var(--primary-glow);
}

.seal-field { margin-bottom: 1.25rem; }
.seal-field label { 
  display: block; 
  font-size: 0.875rem; 
  font-weight: 500; 
  margin-bottom: 0.4rem; 
  color: var(--text-muted); 
}
input, textarea, select {
  width: 100%;
  padding: 0.6rem 0.9rem;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text);
  transition: var(--transition);
}
input:focus { 
  outline: none; 
  border-color: var(--primary); 
  box-shadow: 0 0 0 3px var(--primary-glow); 
  background: var(--bg);
}

/* --- Typography --- */
h1, h2, h3 { letter-spacing: -0.02em; line-height: 1.2; }
.seal-h1 { font-size: 2.5rem; font-weight: 800; }
.seal-h2 { font-size: 1.8rem; font-weight: 700; }
.seal-body { color: var(--text-muted); }

/* --- Badge & Tag --- */
.seal-badge {
  padding: 0.2rem 0.6rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
}

/* --- AI Interaction Visuals --- */
[data-seal-id] { position: relative; }
.seal-ai-highlight {
  outline: 2px solid var(--primary) !important;
  box-shadow: 0 0 0 4px var(--primary-glow) !important;
}
`;
}

module.exports = { getBaseStyles };

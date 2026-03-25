# SEAL vs HTML: A Side-by-Side Comparison

This document shows the same login page expressed in three formats:
raw HTML, SEAL source, and the AI manifest that SEAL generates.
The goal is to make concrete the cognitive difference these representations
create for a human reader, a browser, and an AI agent.

---

## 1. Raw HTML (~120 lines)

This is what a developer typically writes or what a framework like
Bootstrap requires. A browser understands it perfectly. An AI agent
must parse the entire DOM tree, infer semantics from `class` names and
`type` attributes, and guess which elements are interactive and how.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Sign in to your account">
  <title>Sign In</title>
  <link rel="stylesheet" href="/styles/main.css">
</head>
<body class="bg-gray-50 min-h-screen flex items-center justify-center">

  <div class="w-full max-w-sm">

    <!-- Card -->
    <div class="bg-white rounded-xl shadow-lg overflow-hidden">

      <!-- Card header -->
      <div class="px-8 pt-8 pb-4 text-center">
        <img src="/logo.svg" alt="Company Logo" width="48" height="48"
             class="mx-auto mb-4">
        <h1 class="text-2xl font-bold text-gray-900">Welcome back</h1>
        <p class="mt-1 text-sm text-gray-500">
          Sign in to continue to your account
        </p>
      </div>

      <!-- Card body -->
      <div class="px-8 pb-6">
        <form id="login-form" action="/auth/login" method="POST"
              novalidate>

          <!-- Email field -->
          <div class="mb-4">
            <label for="email"
                   class="block text-sm font-medium text-gray-700 mb-1">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autocomplete="email"
              placeholder="you@example.com"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-lg
                     text-sm focus:outline-none focus:ring-2
                     focus:ring-indigo-500 focus:border-transparent"
              aria-describedby="email-hint"
            >
            <p id="email-hint" class="mt-1 text-xs text-gray-400">
              Enter the email you registered with
            </p>
          </div>

          <!-- Password field -->
          <div class="mb-4">
            <label for="password"
                   class="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autocomplete="current-password"
              placeholder="••••••••"
              required
              minlength="8"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg
                     text-sm focus:outline-none focus:ring-2
                     focus:ring-indigo-500 focus:border-transparent"
            >
          </div>

          <!-- Remember me + forgot password row -->
          <div class="mb-6 flex items-center justify-between">
            <label class="flex items-center gap-2 text-sm text-gray-600">
              <input id="remember-me" name="remember" type="checkbox"
                     class="rounded border-gray-300 text-indigo-600
                            focus:ring-indigo-500">
              Remember me
            </label>
            <a href="/auth/forgot-password"
               class="text-sm text-indigo-600 hover:text-indigo-700
                      font-medium">
              Forgot password?
            </a>
          </div>

          <!-- Submit button -->
          <button
            id="submit"
            type="submit"
            class="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700
                   text-white font-semibold rounded-lg text-sm
                   focus:outline-none focus:ring-2 focus:ring-offset-2
                   focus:ring-indigo-500 transition-colors"
          >
            Sign In
          </button>

          <!-- Divider -->
          <div class="my-4 flex items-center gap-3">
            <hr class="flex-1 border-gray-200">
            <span class="text-xs text-gray-400">or</span>
            <hr class="flex-1 border-gray-200">
          </div>

          <!-- Google login -->
          <button
            id="google-login"
            type="button"
            class="w-full py-2.5 px-4 border border-gray-300
                   hover:border-gray-400 text-gray-700 font-semibold
                   rounded-lg text-sm flex items-center justify-center
                   gap-2 focus:outline-none focus:ring-2
                   focus:ring-offset-2 focus:ring-gray-300 transition-colors"
          >
            <img src="/icons/google.svg" alt="" width="18" height="18">
            Continue with Google
          </button>

        </form>
      </div>

      <!-- Card footer -->
      <div class="px-8 py-4 bg-gray-50 border-t border-gray-100
                  text-center">
        <p class="text-sm text-gray-500">
          Don't have an account?
          <a href="/register"
             class="text-indigo-600 hover:text-indigo-700 font-medium">
            Create one for free
          </a>
        </p>
      </div>

    </div>
  </div>

  <script src="/scripts/form-validate.js"></script>
</body>
</html>
```

**Line count:** ~120
**What an AI must do:** traverse the DOM, match `for`/`id` pairs to
discover labels, read `type` attributes to infer field purpose, look up
CSS class names to guess button roles, and write custom parsing logic
for every site that changes its class naming convention.

---

## 2. SEAL Source (~28 lines)

The same page in SEAL. Intent is explicit. Structure is hierarchical and
readable. There are no CSS classes, no `<div>` soup, no attribute noise.

```seal
Page #login-page title="Sign In" route="/login"
  @meta description="Sign in to your account"
  @theme brand=indigo radius=md

  Body
    Section #login-section variant=centered padding=xl

      Card #login-card width=sm shadow=lg
        CardHeader
          Image #brand-logo src="/logo.svg" alt="Company Logo" width=48 height=48
          Text as=h1 size=2xl weight=bold align=center "Welcome back"
          Text as=p size=sm color=muted align=center "Sign in to continue to your account"

        CardBody
          Form #login-form action="/auth/login" method=POST validate=true

            Input #email
              label="Email address" type=email placeholder="you@example.com"
              required=true autocomplete=email hint="Enter the email you registered with"

            Input #password
              label="Password" type=password placeholder="••••••••"
              required=true autocomplete=current-password minlength=8

            Flex justify=between align=center
              Checkbox #remember-me label="Remember me" default=false
              Link #forgot-password href="/auth/forgot-password" size=sm "Forgot password?"

            Button #submit type=submit variant=primary size=lg width=full "Sign In"

            Divider label="or"

            Button #google-login variant=outline size=lg width=full icon=google
              "Continue with Google"

        CardFooter align=center
          Text size=sm color=muted
            "Don't have an account? "
            Link #signup-link href="/register" "Create one for free"
```

**Line count:** ~28 (77% reduction)
**What SEAL adds over raw SEAL source:** the renderer fills in all the HTML,
ARIA attributes, client-side validation wiring, and the AI manifest below —
automatically.

---

## 3. AI Manifest JSON (generated by SEAL renderer)

This is what an AI agent receives when it sends `READ PAGE` to a SEAL endpoint.
It is a compact, structured list of every interactive element, its human-readable
label, its semantic type, and the exact set of actions the agent is permitted
to perform. No HTML parsing, no CSS selector archaeology.

```json
{
  "page": {
    "id": "login-page",
    "title": "Sign In",
    "route": "/login",
    "theme": { "brand": "indigo" }
  },
  "actions": [
    {
      "id": "email",
      "type": "Input",
      "label": "Email address",
      "inputType": "email",
      "required": true,
      "hint": "Enter the email you registered with",
      "actions": ["FILL", "CLEAR", "FOCUS", "BLUR", "READ"]
    },
    {
      "id": "password",
      "type": "Input",
      "label": "Password",
      "inputType": "password",
      "required": true,
      "minlength": 8,
      "actions": ["FILL", "CLEAR", "FOCUS", "BLUR", "READ"]
    },
    {
      "id": "remember-me",
      "type": "Checkbox",
      "label": "Remember me",
      "checked": false,
      "actions": ["CHECK", "UNCHECK", "TOGGLE", "READ"]
    },
    {
      "id": "forgot-password",
      "type": "Link",
      "label": "Forgot password?",
      "href": "/auth/forgot-password",
      "actions": ["CLICK", "NAVIGATE", "READ"]
    },
    {
      "id": "submit",
      "type": "Button",
      "label": "Sign In",
      "buttonType": "submit",
      "actions": ["CLICK", "FOCUS", "BLUR"]
    },
    {
      "id": "google-login",
      "type": "Button",
      "label": "Continue with Google",
      "actions": ["CLICK", "FOCUS", "BLUR"]
    },
    {
      "id": "signup-link",
      "type": "Link",
      "label": "Create one for free",
      "href": "/register",
      "actions": ["CLICK", "NAVIGATE", "READ"]
    }
  ]
}
```

**Token count (JSON):** ~350 tokens
**What an AI must do:** read a list, choose the right IDs, call the listed actions.
No DOM, no CSS, no guessing.

---

## The Cognitive Difference for an AI Agent

### Approach A — HTML parsing (current web)

```
1. Fetch HTML (120+ lines, ~2 800 tokens)
2. Parse the DOM tree
3. Find all <input> elements
4. For each input:
   a. Look up its <label> via the `for` attribute
   b. Read the `type` attribute to guess purpose
   c. Check `required`, `minlength`, `pattern` attributes manually
   d. Infer whether it is inside a <form> and what the form's action is
5. Find all <button> elements
   a. Read inner text to guess purpose ("Sign In" → submit?)
   b. Check `type` attribute (may be missing — defaults to "submit")
   c. Guess which buttons are primary vs secondary from CSS class names
6. Assemble a mental model of "what I can do here"
7. Issue low-level DOM commands (focus, change value, click)
8. Hope the site didn't change its class naming convention
```

**Problems:** fragile, site-specific, requires re-training for each layout,
no standard action vocabulary, cannot verify allowed actions upfront.

---

### Approach B — SEAL manifest (SEAL-powered pages)

```
1. Call READ PAGE → receive manifest (~350 tokens)
2. Manifest already lists every interactive element, its label, and
   its permitted actions in a standard vocabulary
3. Call FILL #email WITH "value"
4. Call FILL #password WITH "value"
5. Call CLICK #submit
6. Call WAIT FOR navigation
```

**Benefits:**
- Works identically on every SEAL page — zero site-specific logic
- Action vocabulary is universal: FILL, CLICK, SELECT, CHECK, SUBMIT, etc.
- Labels are human-readable: no CSS class guessing
- Constraints are explicit: `required`, `minlength`, `pattern` in the manifest
- Permitted actions are pre-declared: agent cannot accidentally call FILL on a Button
- Structured error responses on failure: `{ "errors": [{ "id": "email", "message": "..." }] }`

---

## Summary Table

| Dimension              | Raw HTML          | SEAL Source       | AI Manifest       |
|------------------------|-------------------|-------------------|-------------------|
| Written by             | Developer         | Developer         | SEAL renderer     |
| Read by                | Browser + AI      | Developer         | AI agent          |
| Lines (login page)     | ~120              | ~28               | N/A (JSON)        |
| Tokens (login page)    | ~2 800            | ~350              | ~350              |
| Semantic clarity       | Low (implied)     | High (explicit)   | Highest (flat)    |
| AI parsing required    | Full DOM traversal| N/A               | None              |
| Action vocabulary      | None              | Defined           | Enforced          |
| Layout info for AI     | Pollutes signal   | Not present       | Absent (clean)    |
| Works across all sites | No (site-specific)| Yes               | Yes               |

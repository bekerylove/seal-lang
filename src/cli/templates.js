/**
 * @fileoverview SEAL CLI File Templates
 *
 * Built-in starter templates used by `seal new <name>`.
 * Each template is a function returning a SEAL source string so that the
 * template can embed dynamic values such as the page title.
 *
 * Available template IDs:
 *  - basic      – minimal page skeleton
 *  - login      – login form
 *  - dashboard  – dashboard with nav and stat cards
 *  - form       – complex multi-section form
 *  - landing    – marketing landing page
 *
 * @module seal/cli/templates
 */

'use strict';

// ── Template definitions ──────────────────────────────────────────────────────

/**
 * @type {Object<string, function(string): string>}
 */
const TEMPLATES = {

  // ── basic ────────────────────────────────────────────────────────────────────
  basic: (name) => `Page #${kebab(name)} [title="${title(name)}" lang="en"]
  Header
    Text "Welcome to ${title(name)}"
  End Header

  Main
    Section #hero
      Text "Hello, World!"
    End Section
  End Main

  Footer
    Text "Built with SEAL"
  End Footer
End Page
`,

  // ── login ────────────────────────────────────────────────────────────────────
  login: (name) => `Page #${kebab(name)} [title="${title(name)} – Login" lang="en"]
  Main
    Section #login-section [layout="centered"]
      Card #login-card
        CardHeader
          Text "Sign In" [role="heading" level=1]
        End CardHeader

        CardBody
          Form #login-form [action="/api/auth/login" method="POST"]
            Input #email [type="email" label="Email" placeholder="you@example.com" required]
            Input #password [type="password" label="Password" placeholder="••••••••" required]
            Checkbox #remember [label="Remember me"]

            Flex [gap="md" justify="space-between" align="center"]
              Link #forgot-pw [href="/forgot-password"] "Forgot password?"
              Button #submit-btn [type="submit" variant="primary"] "Sign In"
            End Flex
          End Form
        End CardBody

        CardFooter
          Text "Don't have an account?"
          Link #register-link [href="/register"] "Create one"
        End CardFooter
      End Card
    End Section
  End Main
End Page
`,

  // ── dashboard ────────────────────────────────────────────────────────────────
  dashboard: (name) => `Page #${kebab(name)} [title="${title(name)} – Dashboard" lang="en"]
  Nav #main-nav
    NavBrand #brand [href="/"] "${title(name)}"
    NavMenu
      NavItem #nav-home     [href="/"]          "Home"
      NavItem #nav-reports  [href="/reports"]   "Reports"
      NavItem #nav-settings [href="/settings"]  "Settings"
    End NavMenu
    Button #logout-btn [variant="ghost"] "Sign Out"
  End Nav

  Main #dashboard
    Section #stats [layout="grid" cols=3 gap="lg"]
      Card #card-users
        CardHeader
          Text "Total Users" [role="heading" level=2]
        End CardHeader
        CardBody
          Text #stat-users "—" [role="status"]
        End CardBody
      End Card

      Card #card-revenue
        CardHeader
          Text "Revenue" [role="heading" level=2]
        End CardHeader
        CardBody
          Text #stat-revenue "—" [role="status"]
        End CardBody
      End Card

      Card #card-orders
        CardHeader
          Text "Orders" [role="heading" level=2]
        End CardHeader
        CardBody
          Text #stat-orders "—" [role="status"]
        End CardBody
      End Card
    End Section

    Section #recent-activity
      Text "Recent Activity" [role="heading" level=2]
      Table #activity-table
        Columns
          Column #col-date   [label="Date"   sortable]
          Column #col-user   [label="User"   sortable]
          Column #col-action [label="Action"]
          Column #col-status [label="Status"]
        End Columns
        Rows
        End Rows
      End Table
    End Section
  End Main
End Page
`,

  // ── form ─────────────────────────────────────────────────────────────────────
  form: (name) => `Page #${kebab(name)} [title="${title(name)} – Form" lang="en"]
  Main
    Section #form-section
      Text "Contact Us" [role="heading" level=1]

      Form #contact-form [action="/api/contact" method="POST"]
        // ── Personal details ──────────────────────────────────────────────────
        Section #personal-details [legend="Personal Details"]
          Grid [cols=2 gap="md"]
            Input #first-name [label="First Name" placeholder="Jane" required]
            Input #last-name  [label="Last Name"  placeholder="Doe"  required]
          End Grid
          Input #email [type="email" label="Email Address" placeholder="jane@example.com" required]
          Input #phone [type="tel"   label="Phone Number"  placeholder="+66 81 234 5678"]
        End Section

        // ── Subject & message ─────────────────────────────────────────────────
        Section #message-details [legend="Your Message"]
          Select #subject [label="Subject" required]
            Option [value="support"]  "Technical Support"
            Option [value="billing"]  "Billing Inquiry"
            Option [value="feedback"] "General Feedback"
            Option [value="other"]    "Other"
          End Select
          Textarea #message [label="Message" placeholder="Describe your issue or question…" rows=6 required]
        End Section

        // ── Preferences ───────────────────────────────────────────────────────
        Section #preferences [legend="Preferences"]
          Checkbox #newsletter [label="Subscribe to newsletter"]
          Checkbox #terms      [label="I agree to the Terms of Service" required]
        End Section

        Flex [gap="md" justify="flex-end"]
          Button #reset-btn  [type="reset"  variant="outline"]  "Clear"
          Button #submit-btn [type="submit" variant="primary"]  "Send Message"
        End Flex
      End Form
    End Section
  End Main
End Page
`,

  // ── landing ──────────────────────────────────────────────────────────────────
  landing: (name) => `Page #${kebab(name)} [title="${title(name)}" lang="en"]
  Nav #main-nav [sticky]
    NavBrand #brand [href="/"] "${title(name)}"
    NavMenu
      NavItem #nav-features [href="#features"] "Features"
      NavItem #nav-pricing  [href="#pricing"]  "Pricing"
      NavItem #nav-about    [href="#about"]     "About"
    End NavMenu
    Button #cta-nav [href="/signup" variant="primary"] "Get Started"
  End Nav

  Main
    // ── Hero ─────────────────────────────────────────────────────────────────
    Section #hero [layout="centered" padding="xl"]
      Text "Build Faster with ${title(name)}" [role="heading" level=1 size="2xl"]
      Text "The simplest way to create AI-readable web pages."
      Flex [gap="md" justify="center"]
        Button #cta-hero    [href="/signup"  variant="primary"]  "Start Free Trial"
        Button #cta-demo    [href="/demo"    variant="outline"]   "View Demo"
      End Flex
    End Section

    // ── Features ──────────────────────────────────────────────────────────────
    Section #features [layout="grid" cols=3 gap="lg" padding="lg"]
      Text "Features" [role="heading" level=2]

      Card #feature-1
        CardHeader
          Icon #icon-fast [name="zap"]
          Text "Fast" [role="heading" level=3]
        End CardHeader
        CardBody
          Text "Ship pages in minutes, not hours."
        End CardBody
      End Card

      Card #feature-2
        CardHeader
          Icon #icon-ai [name="cpu"]
          Text "AI-Ready" [role="heading" level=3]
        End CardHeader
        CardBody
          Text "Every element is machine-readable by default."
        End CardBody
      End Card

      Card #feature-3
        CardHeader
          Icon #icon-secure [name="shield"]
          Text "Secure" [role="heading" level=3]
        End CardHeader
        CardBody
          Text "Built-in security best practices."
        End CardBody
      End Card
    End Section

    // ── Pricing ───────────────────────────────────────────────────────────────
    Section #pricing [layout="grid" cols=2 gap="lg" padding="lg"]
      Text "Pricing" [role="heading" level=2]

      Card #plan-free
        CardHeader
          Text "Free" [role="heading" level=3]
          Badge "Forever free"
        End CardHeader
        CardBody
          List
            Item "Up to 5 pages"
            Item "Community support"
            Item "Basic templates"
          End List
        End CardBody
        CardFooter
          Button #btn-free [href="/signup?plan=free" variant="outline"] "Get Started"
        End CardFooter
      End Card

      Card #plan-pro
        CardHeader
          Text "Pro" [role="heading" level=3]
          Badge "$9 / month" [variant="primary"]
        End CardHeader
        CardBody
          List
            Item "Unlimited pages"
            Item "Priority support"
            Item "All templates"
            Item "AI command analytics"
          End List
        End CardBody
        CardFooter
          Button #btn-pro [href="/signup?plan=pro" variant="primary"] "Start Pro Trial"
        End CardFooter
      End Card
    End Section
  End Main

  Footer #main-footer
    Text "© ${new Date().getFullYear()} ${title(name)}. All rights reserved."
    Nav #footer-nav
      NavItem [href="/privacy"] "Privacy"
      NavItem [href="/terms"]   "Terms"
    End Nav
  End Footer
End Page
`,
};

// ── Utility helpers ───────────────────────────────────────────────────────────

/**
 * Convert a name string to kebab-case (suitable for IDs).
 * @param {string} name
 * @returns {string}
 */
function kebab(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Convert a name string to Title Case.
 * @param {string} name
 * @returns {string}
 */
function title(name) {
  return name
    .trim()
    .replace(/-+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * All available template IDs.
 * @type {string[]}
 */
const TEMPLATE_IDS = Object.freeze(Object.keys(TEMPLATES));

/**
 * Retrieve a template by ID and render it for a given page name.
 *
 * @param {string} templateId - One of {@link TEMPLATE_IDS}.
 * @param {string} name       - Page name used to derive the ID and title.
 * @returns {string} Rendered SEAL source text.
 * @throws {Error} If templateId is not recognised.
 */
function getTemplate(templateId, name) {
  const fn = TEMPLATES[templateId];
  if (!fn) {
    throw new Error(
      `Unknown template "${templateId}". Available: ${TEMPLATE_IDS.join(', ')}`
    );
  }
  return fn(name || templateId);
}

module.exports = { getTemplate, TEMPLATE_IDS, TEMPLATES };

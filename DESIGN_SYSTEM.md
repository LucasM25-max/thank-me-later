# Thank Me Later — Canonical Design System

Status: **Canonical / binding**

This document defines the only visual language for Thank Me Later. Every current screen and every future screen must use this system. Do not create a second visual system, a one-off palette, a new spacing scale, or component-specific visual values that contradict these rules.

## 1. Design goal

Thank Me Later is an editorial, calm, warm, premium workspace. The reference point is the restrained feel of claude.ai: generous whitespace, strong typography, low visual noise, quiet controls, and a warm neutral canvas.

The product should feel designed rather than "AI-generated". The interface is minimal, but it is not sterile. The personality comes from typography, proportion, rhythm, and a restrained russet accent — not from gradients, neon, glass effects, animated blobs, 3D objects, giant AI imagery, excessive pills, dashboard cards, or decorative spectacle.

The quality bar is:

> Minimal enough that nothing feels unnecessary. Distinctive enough that it feels designed. Warm enough that it feels human. Refined enough that it has aura.

## 2. Non-negotiable rules

1. Use the global CSS tokens in `style.css` for all colours, spacing, radii, shadows, typography, and motion.
2. Reuse the shared primitives and existing semantic component classes before creating new visual values.
3. Never hardcode a new hex colour, arbitrary shadow, custom radius, custom spacing value, or custom transition in a new screen.
4. Never introduce a separate dark/light design system. The code workspace may use the dedicated technical dark material tokens already defined in the global system, but it remains part of the same system.
5. Lucide icons are the canonical icon language. Do not replace icons with text glyphs where a Lucide icon exists.
6. Buttons, inputs, popovers, menus, modals, status indicators, tabs, cards/surfaces, and empty states must use the shared component vocabulary.
7. Do not add gradients, glassmorphism, neon effects, animated decorative backgrounds, oversized statistics, floating 3D AI objects, robot/brain imagery, or generic AI landing-page patterns.
8. Motion is functional and restrained. Animation should communicate navigation, focus, loading, or state — never serve as decoration.
9. Prefer separators, typography, whitespace, and alignment over boxes. A surface is justified only when it helps hierarchy or interaction.
10. New UI must be tested against the Chat, Connectors, Live Translate, Library/Saved Transcript, authentication, and Code Environment screens to ensure it belongs to the same product.

## 3. Tokens

All tokens live in `style.css` under `:root` and are reused through `var(...)`.

### Colour

- `--color-canvas`: primary warm page background.
- `--color-canvas-alt`: slightly differentiated workspace background.
- `--color-sidebar`: navigation background.
- `--color-surface`: primary raised surface.
- `--color-surface-raised`: popover/modal/overlay surface.
- `--color-surface-soft`: low-emphasis inset surface.
- `--color-ink`: primary text.
- `--color-ink-muted`: secondary text.
- `--color-ink-subtle`: tertiary metadata.
- `--color-border`: standard separator and control border.
- `--color-border-strong`: focused/active border.
- `--color-accent`: restrained russet accent.
- `--color-accent-strong`: pressed/active accent.
- `--color-accent-soft`: subtle accent wash.
- `--color-success`, `--color-warning`, `--color-danger`: state colours, used sparingly and only for state.
- `--color-overlay`: modal scrim.

The accent is never used as decoration. It is reserved for primary actions, links, selected states, and meaningful product emphasis.

### Typography

- `--font-ui`: DM Sans for UI, controls, metadata, and body copy.
- `--font-editorial`: Source Serif 4 for large titles and editorial feature headings.
- `--font-mono`: system monospace stack for code and paths.

Editorial headings are large but not oversized. UI labels are compact and legible. Do not use all-caps except for small eyebrow/meta labels.

### Spacing

Use the global scale: `--space-1` through `--space-9`.

Prefer 8/12/16/24/32/48/64px rhythms. Use smaller values only inside controls and icon containers. Do not invent a new spacing scale.

### Radius

Use `--radius-sm`, `--radius-md`, `--radius-lg`, and `--radius-xl`.

Large radii are reserved for major surfaces or dialogs. Inline controls use smaller radii. Pills are allowed only for compact status/metadata or command state; they must never become the default shape for every control.

### Depth

Use `--shadow-sm`, `--shadow-md`, and `--shadow-lg`.

The interface should appear mostly flat. Shadows are for elevation hierarchy, not decoration.

### Motion

Use `--ease-standard`, `--duration-fast`, and `--duration-standard`.

Interactions should be quiet and fast. Never add bounce, elastic movement, continuous decorative motion, or long transitions to routine UI.

## 4. Shared component vocabulary

### Page

Feature pages use a consistent shell: small eyebrow → serif title → short explanation → primary workspace/content. The exact composition may change by feature, but typography, width, spacing, and controls do not.

### Button

Use these semantic patterns only:

- Primary: filled accent, reserved for the main action.
- Secondary: neutral surface + border.
- Ghost: no fill, used for secondary navigation or icon actions.
- Destructive: quiet danger treatment; never a saturated dashboard-style danger button.
- Icon button: square/near-square control with Lucide icon and accessible label.

Do not create a custom button merely to change radius, colour, or shadow.

### Input / Select

Inputs share the same height, border, radius, text treatment, focus ring, and surface. Labels are compact and muted. Placeholder text is subtle.

### Popover / Menu

Menus use the raised surface, border, `--shadow-md`, `--radius-lg`, and a short fade/slide. Items use a consistent hit target and hover treatment.

### Modal

Modals use the raised surface, strong but quiet scrim, `--shadow-lg`, `--radius-xl`, clear heading hierarchy, and one clear primary action.

### Status

Status should read as metadata. Prefer a small dot + text or a compact state label rather than a large colourful badge.

### Surface / Card

Use a surface when grouping materially improves comprehension. Avoid nesting many surfaces. Prefer one strong container and separators inside it.

### Divider

Use the global border token. Dividers are structural, not decorative.

### Empty state

Empty states are editorial and helpful: one quiet icon, a concise serif title, one explanatory sentence, then a single useful action.

## 5. Screen rules

### Chat

Chat is the visual reference screen. The message column is narrow and editorial. User messages remain visually distinct but should not look like a conventional consumer chat bubble stack. The composer is the most engineered surface: stable, spacious, tactile, and quiet.

### Sidebar / navigation

The sidebar is an anchor, not a dashboard. Keep it visually quiet. Navigation labels, active state, recent chats, connector entry, and account control share the same row language.

### Connectors

Connectors are an editorial settings page, not a SaaS admin dashboard. Use one strong GitHub row, metadata, a clear enable/disable action, and restrained status feedback. Avoid oversized cards and large badges.

### Live Translate

Live Translate is a translation studio. The primary focus is language direction, session state, and the transcript. The old large glowing orb is not the visual centre of gravity; the signal can be represented by a small restrained state indicator. Audio activity should feel alive without turning into an AI-demo visual effect.

### Library / Saved Transcript

Treat these as a personal archive/notebook. Prefer a list or document-like surface with dates and excerpts over card grids. Saved transcripts and library browsing should feel related.

### Code Environment

The code workspace intentionally uses a darker technical material, but its layout, typography, controls, borders, tabs, states, and spacing still come from this system. Do not create a second product inside the runner.

### Authentication / account menu

Authentication uses the same typography, warm canvas, control language, accent, border, and motion. It should feel like entering the same application, not opening a generic auth template.

## 6. Iconography

Lucide is the canonical icon library. Use consistent stroke weight, size, and placement. Typical sizes are 14–18px for controls, 18–22px for feature anchors, and 12–14px for metadata. Icons are never decorative noise; they clarify actions or navigation.

## 7. Accessibility and interaction

Every actionable control needs a visible keyboard focus state using the global focus ring. Hover states must not be the only state indicator. Disabled states reduce contrast without destroying legibility. Icon-only controls require `aria-label` or an equivalent accessible name.

Respect reduced-motion preferences. Do not make the interface dependent on animation for comprehension.

## 8. How future work must use this system

Before creating a new screen or component:

1. Read this document and `style.css`.
2. Find an existing component with the same interaction type.
3. Reuse its class/primitive and token values.
4. Add a new semantic component class only when the existing vocabulary cannot express the interaction; build it from the same tokens.
5. Do not add a local colour, shadow, radius, spacing, or typography value unless the value is first promoted into the global token system and is genuinely reusable.
6. Do not append a "final overrides" stylesheet to win a specificity battle. Fix the shared component or token instead.
7. Before committing, compare the new screen against the existing Chat, Connectors, Live Translate, Library, Saved Transcript, auth, and code runner surfaces.

The global design system is the single source of truth. New screens must consume it; they must not compete with it.

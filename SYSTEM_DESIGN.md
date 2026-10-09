# FRSYS Design System

How the FRSYS client looks, moves and behaves, and the rules for keeping new screens consistent with it.

- **Code:** `client/REACT_CLIENT/src`
- **Tokens:** `index.css`
- **Shared components:** `styles/Common.css`
- **Motion:** the [`motion`](https://motion.dev) package (`motion/react`)

## 1. Principles

FRSYS is an operations tool. Admins manage people and outings at a desk. Guards watch a camera at an entrance post and must understand a face's status in a glance.

1. **Status first.** The one thing a guard needs (*in outing*, *not on outing*, *unknown*, *late*) is always the most visible element. It is shown by colour **and** text, never colour alone.
2. **Calm and dense.** Neutral surfaces, one accent for actions and tinted status colours. No decoration that competes with data.
3. **Motion explains changes.** Animation shows that something arrived, left or changed. It never delays work, and it turns off with the OS "reduce motion" setting.
4. **Works for everyone.** Light and dark themes, Arabic right-to-left, keyboard navigation, 44px touch targets, WCAG AA contrast.

## 2. Tokens

All values are CSS custom properties on `:root` in `index.css`. Components never use raw hex values, pixel sizes or durations. Use a token, or add one.

### Colour

Light is the default. Dark follows `prefers-color-scheme: dark`; both themes define every token.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-bg` | `#f1f5f9` | `#0b1120` | Page background (with a soft blue/green glow) |
| `--color-surface` | `#ffffff` | `#131c2e` | Cards, page container |
| `--color-surface-2` | `#f8fafc` | `#182237` | Panels, table header, form area |
| `--color-surface-3` | `#eef2f7` | `#1f2a42` | Hover fills, placeholders |
| `--color-text` | `#0f172a` | `#f1f5f9` | Body text, headings |
| `--color-text-muted` | `#475569` | `#a8b4c7` | Secondary text, labels |
| `--color-text-subtle` | `#64748b` | `#8a98ad` | Hints, empty states, table headers |
| `--color-border` / `-strong` | `#e2e8f0` / `#cbd5e1` | `#24314a` / `#33425f` | Dividers / input borders |
| `--color-primary` | `#2563eb` | `#3b82f6` | Links, focus, navigation, secondary actions |
| `--color-accent` | `#16a34a` | `#22c55e` | **Go** actions: create, save, connect, start camera |
| `--color-danger` | `#dc2626` | `#ef4444` | Stop camera, confirmed deletes |

### Status colours

Every status has a tinted background (`-bg`), readable text (`-fg`) and a solid colour (`-solid`) for borders and dots.

| Meaning | Token family | Where |
|---|---|---|
| OK, in outing, returned on time, online, connected | `--status-success-*` | Check-in "in outing", "On time", presence dot, connected chip |
| Attention: not on an outing, pending, late, connecting | `--status-warning-*` | Check-in "not on outing", "Pending", "Late", connecting chip |
| Problem: unknown face, no match, error, disconnected | `--status-danger-*` | Unknown faces, errors, camera stopped |
| Informational | `--status-info-*` | Edit buttons, active nav item, admin role |
| Neutral | `--status-neutral-*` | Guest role, empty or idle states |

### Typography

| Token | Value | Use |
|---|---|---|
| `--font-sans` | Fira Sans, then IBM Plex Sans Arabic, then system UI | All interface text. Fira has no Arabic glyphs, so Arabic falls through to Plex Sans Arabic. |
| `--font-mono` | Fira Code | **Data:** matricules, times, IDs, RTSP URLs, Excel column names (class `.mono` or `<code>`) |
| `--text-xs` … `--text-2xl` | 12, 14, 16, 18, 22, 28 px | Body is 16px; nothing below 12px |

Numbers use `font-variant-numeric: tabular-nums` in tables, cards and lists, so columns line up.

### Space, shape, depth

- **Spacing:** a 4px grid, `--space-1` (4) … `--space-10` (40).
- **Radius:** `--radius-sm` 6 (chips in forms), `--radius-md` 10 (buttons, inputs), `--radius-lg` 14 (cards, panels), `--radius-full` (pills, dots).
- **Shadow:** `--shadow-sm` (resting cards), `--shadow-md` (page container, hovered cards), `--shadow-lg` (login card).
- **Glass:** `--glass-bg` and `--glass-border`, **only** on the sticky navigation bar. Data surfaces stay opaque for contrast.
- **Sizes:** `--control-height` 44px (minimum touch target), `--page-max` 1240px.

### Motion

| Token | Value | Use |
|---|---|---|
| `--duration-fast` | 120ms | Hover, press, colour changes |
| `--duration-base` | 200ms | Alerts appearing, menus, icon swaps |
| `--duration-slow` | 320ms | Cards and panels entering |
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | Everything that enters or responds |
| `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | Looping pulses |

## 3. Layout

- **Page:** every page is one `.container` (or `.checkins-container`): a centred surface card, max width 1240px.
- **Header:** each page starts with an `h1`, then an optional `.page-subtitle`.
- **Toolbar:** `.controls` is the row under the title. It holds the camera button, filters and the main action, and wraps on small screens.
- **Grids:** collections use responsive grids (`.persons-cards-grid`, `.feature-grid`, `.guest-cards-list`, `.detections-grid`) with `auto-fill` and a `min(100%, …)` minimum, so they never scroll sideways.
- **Breakpoints:**

  | Width | What changes |
  |---|---|
  | 1440px | Navigation shows the logo only (the name stays available to screen readers) |
  | 1100px | Navigation collapses into the menu button |
  | 960px | The video page stacks the detections under the video |
  | 768px | Page padding shrinks |
  | 640px | Record cards stack their actions under the content |

- **Video:** the frame keeps a 16:9 box (`aspect-ratio`) before the first frame arrives, so the page doesn't jump.

### Right-to-left

Arabic sets `dir="rtl"` on `.app`. Write layout with **logical properties**, so it mirrors automatically:

- `margin-inline-start`, not `margin-left`
- `padding-inline`, `border-inline-start`, `inset-inline-end`
- `text-align: start`

Only use `[dir='rtl']` overrides for things logical properties can't express, such as the select arrow position.

## 4. Components

All in `styles/Common.css` unless noted.

### Buttons

| Class | Look | Use for |
|---|---|---|
| `.connect-btn` | Solid green | The main positive action: Add, Save, Sign in, Mark returned |
| `.disconnect-btn` | Outlined neutral | Cancel, close |
| `.btn-edit` | Soft blue | Edit and other non-destructive secondary actions |
| `.btn-delete` | Soft red, solid red on hover | Delete. Always confirm first. |
| `.camera-toggle-btn` | 56px round, green (play) or red (stop) | Start or stop the camera (`<CameraToggleButton>`) |

Every button is at least 44px tall, shows a visible focus ring on keyboard focus, and gives press feedback (moves 1px down). Disabled buttons are dimmed and show a `not-allowed` cursor.

### Inputs

`.form-group` wraps a visible `<label>` and its field. Fields are 44px tall, at 16px text (so iOS doesn't zoom on focus), with a primary-coloured border on focus. `.control-select` is the compact select used in toolbars. Never use a placeholder as the label.

### Surfaces

| Class | What it is |
|---|---|
| `.panel` | Grouped section inside a page (Home: guests online, notifications) |
| `.form-container` | Add or edit form, slides in when opened |
| `.data-table` | Scrollable, bordered table; small uppercase column headers |
| `.person-split-card` | Record card: photo, details, actions (persons, outings, returns, cameras). Lifts on hover. |
| `.feature-card` | Home shortcut card: a real link to the page, with a gradient top edge on hover |
| `.guest-card` / `.guest-mini-card` | Guard account card / small presence pill (`styles/GuestCards.css`) |
| `.person-card` | Check-in card for one face (`styles/CheckIns.css`). Its tone colours come from the status icon class it contains. |

### Status display

| Class | What it is |
|---|---|
| `.status-badge` + `.status-pending` / `.status-completed` | Outing state pill |
| `.status-active` / `.status-inactive` | Account or online state pill |
| `.camera-status-chip` + `-running` / `-checking` / `-stopped` | Camera connection (`<CameraStatusChip>`); "checking" pulses |
| `.status` + `.connected` / `.connecting` / `.disconnected` | Live connection line with a coloured dot |
| `.status-dot.online` / `.offline` | Presence dot on a guard's avatar; online dots send out a soft ring |
| `.detection-item` (+ `.no-match`) | Line in a live list; green left edge, red when unknown, late or offline |
| `.error` | Inline error message, placed right where the problem is |
| `.empty-state` | "Nothing here yet" text inside a panel or list |

## 5. Motion

Two layers, both following the OS "reduce motion" setting:

- **CSS** (in the stylesheets): hover, focus and press transitions, cards rising in, staggered grids (30ms apart, capped after 12 items), and the pulses on "connecting" and "online".
- **[Motion](https://motion.dev)** (`motion/react`): wherever React adds or removes elements, or something moves between places. `<MotionConfig reducedMotion="user">` in `main.jsx` applies the reduce-motion setting to all of it.

| Where | What | Why |
|---|---|---|
| `App.jsx` | Each page fades in and rises 6px (220ms, no exit wait) | Confirms the navigation without slowing it |
| `Navigation.jsx` | The active-page pill slides to the new link (`layoutId`, spring with no bounce) | Shows where you are and where you came from |
| `CheckIns.jsx` | A card appears when a person steps in front of the camera and leaves when they step away (`AnimatePresence`, `popLayout`) | The arrival or departure of a person **is** the information |
| `Rentrees.jsx` | A new return event slides in at the top of "Recent events" | Draws the guard's eye to a return just recorded |
| `Home.jsx` | Guards online appear and disappear; new notifications slide in | Live presence changes are visible without reading the list |

Rules:

- **Durations:** 120–320ms. Exits are faster than entrances (about 150ms).
- **No overshoot:** springs use `bounce: 0`. This is a data UI, and bounces read as sloppy.
- **Cheap properties:** animate `opacity` and `transform` only, never width, height or top.
- **Stable keys for live lists:** check-in cards are keyed by **matricule**, so a card animates only when a person arrives or leaves, not on every camera frame (several per second). Unknown faces are keyed by position, because they share labels like "No match".
- **Imports:** import from `motion/react`, never from `framer-motion`.

## 6. Accessibility checklist

Run this for any new or changed screen:

- [ ] Text contrast is at least 4.5:1 in **both** themes (use the tokens; they are chosen for this)
- [ ] Every status is readable without colour: there is a text label
- [ ] Every input has a visible `<label>`; errors show next to the problem
- [ ] Keyboard: everything is reachable with Tab, and focus is always visible (`:focus-visible` ring)
- [ ] Icon-only buttons have an `aria-label` (camera toggle, menu, language)
- [ ] Decorative images use `alt=""` and `aria-hidden="true"`
- [ ] Touch targets are at least 44×44px
- [ ] It works at 375px wide with no sideways scroll, and in Arabic (RTL)
- [ ] Nothing important depends on animation; it works with "reduce motion" on

## 7. Adding a screen

1. **Container:** wrap the page in `.container`, starting with `<h1>`.
2. **Toolbar:** put actions and filters in `.controls`. The main action uses `.connect-btn`.
3. **Collections:** use `.persons-cards-grid` with `.person-split-card` for records, or `.data-table` for tabular data.
4. **Forms:** use `.form-container` and `.form-group`, ending with `.form-actions` (Save = `.connect-btn`, Cancel = `.disconnect-btn`).
5. **Colours:** for any status, pick the status token family by meaning (section 2), not by the colour you'd like.
6. **Camera:** for camera features, use `useStreamSocket` + `<CameraStatusChip>` + `<CameraToggleButton>`.
7. **Motion:** only add Motion when elements are added, removed or moved by live data. Everything else uses the CSS transitions you get for free.
8. **Translations:** put every user-facing string in `context/LangContext.jsx`, in both languages.

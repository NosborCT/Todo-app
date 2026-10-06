---
name: Chrono Precision Workspace
colors:
  surface: '#f9f9ff'
  surface-dim: '#d3daef'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f1f3ff'
  surface-container: '#e9edff'
  surface-container-high: '#e1e8fd'
  surface-container-highest: '#dce2f7'
  on-surface: '#141b2b'
  on-surface-variant: '#4a4455'
  inverse-surface: '#293040'
  inverse-on-surface: '#edf0ff'
  outline: '#7b7487'
  outline-variant: '#ccc3d8'
  surface-tint: '#732ee4'
  primary: '#630ed4'
  on-primary: '#ffffff'
  primary-container: '#7c3aed'
  on-primary-container: '#ede0ff'
  inverse-primary: '#d2bbff'
  secondary: '#712edd'
  on-secondary: '#ffffff'
  secondary-container: '#8b4ef7'
  on-secondary-container: '#fffbff'
  tertiary: '#5d25c7'
  on-tertiary: '#ffffff'
  tertiary-container: '#7645e0'
  on-tertiary-container: '#ece1ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#eaddff'
  primary-fixed-dim: '#d2bbff'
  on-primary-fixed: '#25005a'
  on-primary-fixed-variant: '#5a00c6'
  secondary-fixed: '#ebddff'
  secondary-fixed-dim: '#d3bbff'
  on-secondary-fixed: '#250059'
  on-secondary-fixed-variant: '#5b00c5'
  tertiary-fixed: '#e9ddff'
  tertiary-fixed-dim: '#d0bcff'
  on-tertiary-fixed: '#23005c'
  on-tertiary-fixed-variant: '#5516be'
  background: '#f9f9ff'
  on-background: '#141b2b'
  surface-variant: '#dce2f7'
typography:
  display:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0.005em
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.03em
  mono-code:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  sidebar-width: 240px
  space-2xs: 0.125rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-base: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
  gutter-canvas: 1.5rem
---

## Brand & Style
The design system embodies focused momentum, intellectual clarity, and precision engineering for knowledge workers, developers, and operators. The visual character merges Swiss-inspired functional minimalism with high-end desktop application craftsmanship. Interactions evoke calm control and frictionless execution, eliminating visual clutter in favor of intentional whitespace, typographic clarity, and purposeful chromatic accents.

Key emotional anchors:
- **Quiet Authority:** Surfaces recede to allow user tasks and project timelines to command full focus.
- **Kinetic Precision:** High-contrast violet accents identify priority states, active contexts, and immediate calls to action without producing sensory fatigue.
- **Architectural Cohesion:** Strict alignment rules, proportional spatial intervals, and consistent physical planes give desktop workflows an intuitive tactile rhythm.

## Colors
The palette relies on deep optical neutrals paired with high-energy violet hues calibrated for precise contrast standards across both light and dark execution modes.

### Light Mode Surfaces & Text
- **Canvas Base:** `#F8F9FA` creates an easy-on-the-eyes boundary behind foreground panels.
- **Surface Elevation:** `#FFFFFF` for primary cards, active content panes, popovers, and dialogs.
- **Sidebar Surface:** `#F3F4F6` delineates navigation hierarchy cleanly without heavy dividing lines.
- **Borders & Dividers:** `#E5E7EB` with high-subtlety dividers at `#F3F4F6`.
- **Text Primary:** `#111827` (slate black) for high-legibility titles and body copy.
- **Text Secondary:** `#374151` for labels, timestamps, and secondary descriptions.
- **Text Muted:** `#6B7280` for placeholder states, hotkey hints, and disabled contexts.

### Dark Mode Surfaces & Text
- **Canvas Base:** `#0F172A` deep obsidian foundation.
- **Surface Elevation:** `#1E293B` elevated cards, work items, and modal layers.
- **Sidebar Surface:** `#0B1120` sunken primary workspace drawer.
- **Borders & Dividers:** `#334155` provides structural definition.
- **Text Primary:** `#F8FAFC` crisp text contrast.
- **Text Secondary:** `#CBD5E1` muted labels and secondary fields.
- **Text Muted:** `#64748B` assistive annotations.

### Accent & Feedback Tokens
- **Primary Violet:** `#7C3AED` drives interactive anchors, active tabs, and primary action triggers.
- **Primary Hover:** `#6D28D9` for pressed/hover light states; `#8B5CF6` for interactive elements in dark mode.
- **Active Soft Tint (Light):** `rgba(124, 58, 237, 0.08)` for sidebar selections and badge backgrounds.
- **Active Soft Tint (Dark):** `rgba(139, 92, 246, 0.16)` for dark mode list selection states.
- **Semantic Accents:** Success `#059669`, Warning `#D97706`, Danger `#DC2626`.

## Typography
The typography system is built entirely on Inter to ensure clean numeric tabular alignment, crisp legibility at small scale, and high visual density without eye strain. Monospaced elements for key shortcuts and timer values leverage JetBrains Mono.

- **Scale Rhythm:** Headings use tighter tracking (`-0.02em` to `-0.005em`) to consolidate visual weight.
- **Tabular Figures:** All counts, timers, dates, and metric badges must use OpenType tabular figure settings (`font-feature-settings: 'tnum' on, 'cv05' on`) to ensure zero horizontal jitter during real-time updates.
- **Microcopy Discipline:** Badges and hotkey indicators use `label-sm` with upper-cased styling or explicit semi-bold execution for instant optical recognition.

## Layout & Spacing
The layout uses a multi-pane desktop architecture anchored by a fixed left-hand navigation structure:

- **Sidebar (Fixed):** Width is strictly locked at `240px`. It hosts workspace switchers, main view selectors, tags, and dynamic counter badges.
- **Workspace Canvas (Fluid):** Consumes `calc(100vw - 240px)`. Can be divided into split columns (e.g., Task List at `420px` fixed/flexible, Detail Panel spanning remaining space).
- **Spatial Grid:** Built upon a standard 4px/8px incremental scale. Dense layouts default to 8px gap spacing between interactive elements and 12px/16px padding within container cards.
- **Window Constraints:** Minimal desktop viewport width target is `1024px`. Below `1024px`, the 240px sidebar transforms into an overlay slide-out drawer accessible via hotkey (`Cmd/Ctrl + \`) or menu trigger.

## Elevation & Depth
Depth is communicated through flat tonal planar layering supported by whisper-soft, colored ambient shadows and fine 1px structural outlines.

- **Level 0 (App Shell / Canvas):** Flat baseline (`#F8F9FA` light / `#0F172A` dark). Zero shadow.
- **Level 1 (Card & Content Blocks):** 1px border (`#E5E7EB` light / `#334155` dark) with ambient shadow:
  `0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.02)`.
- **Level 2 (Hover States & Context Drawers):**
  `0 4px 6px -1px rgba(0, 0, 0, 0.06), 0 2px 4px -2px rgba(0, 0, 0, 0.04)`.
- **Level 3 (Command Menu, Floating Modals, Dropdowns):**
  `0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.05)`. In dark mode, append a 1px border `rgba(255, 255, 255, 0.08)` to maintain boundary contrast.

## Shapes
The design uses an 8px (`0.5rem`) geometric corner radius as the primary visual signature across cards, text inputs, buttons, and popovers.

- **Standard Elements (Buttons, Inputs, Cards, Badges):** Fixed 8px (`rounded-lg` in utility scales).
- **Micro Elements (Hotkeys, Checkboxes, Tooltips):** 4px to 6px (`rounded-md`).
- **Status Pills & Progress Trackers:** Full capsule roundedness (`9999px`) reserved exclusively for circular avatars, standalone tags, and numeric counter capsules.

## Components

### 1. Sidebar Navigation Items
- **Dimensions & Geometry:** Height of 36px, horizontal padding of 8px, 8px corner radius.
- **States:**
  - *Default:* Transparent background, `#374151` text, muted icon.
  - *Hover:* Background `#E5E7EB` (light) / `#1E293B` (dark), text `#111827`.
  - *Active:* Background `rgba(124, 58, 237, 0.08)` (light) / `rgba(139, 92, 246, 0.16)` (dark), label `#7C3AED` (light) / `#A78BFA` (dark), icon filled/tinted `#7C3AED`.
- **Counters:** Positioned flush-right. Pill radius, font `label-sm`, tabular numerals. When parent is active, the counter displays violet text.

### 2. Buttons
- **Primary:** Background `#7C3AED`, hover `#6D28D9`, active scale `0.99`. Text `#FFFFFF`, font `label-md`, height 36px, radius 8px.
- **Secondary / Ghost:** 1px border `#E5E7EB`, background `#FFFFFF`, text `#374151`. Hover background `#F9FAFB`. Dark mode border `#334155`, background `#1E293B`, text `#F8FAFC`.

### 3. Checkboxes (Task Items)
- **Geometry:** 18px x 18px box, 5px radius. Border 1.5px `#D1D5DB`.
- **Checked State:** Smooth transition into `#7C3AED` fill with white SVG checkmark; companion task title receives muted color `#9CA3AF` with clean strike-through.

### 4. Input Fields & Quick-Add
- **Dimensions:** 38px height, 8px radius, border 1px `#E5E7EB` (light) / `#334155` (dark).
- **Focus:** 1px `#7C3AED` ring with `0 0 0 2px rgba(124, 58, 237, 0.2)`. Zero layout shift.

### 5. Task Cards & Rows
- **Card View:** Surface `#FFFFFF` (light) / `#1E293B` (dark), 8px border radius, 12px inner padding, 1px perimeter outline.
- **Row Item View:** Flexible list item, 44px min-height, border-bottom 1px `#F3F4F6` (light) / `#1E293B` (dark), hover background `#F9FAFB` (light) / `#1E293B` (dark).

### 6. Command Palette (`Cmd + K`)
- **Structure:** Width 600px, centered top-third elevation. Deep backdrop blur `blur(8px) rgba(15, 23, 42, 0.4)`.
- **Input:** 48px height, unbordered, 16px font size, clean search icon prefix, `ESC` hint pill suffix.
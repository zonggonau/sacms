# SaCMS Design System v1.0

**Status:** Published  
**Last Updated:** 2026-11-23  
**Audience:** Developers, Designers, Product Team

---

## Visual Thesis

**Warm, rationalist interface with technical credibility** — where data breathes, decisions are legible, and Papuan craft meets developer precision.

---

## Typography

### Display & Headlines
**Font:** Work Sans (Google Fonts)  
**Weight:** 500 (Medium) or 600 (Semibold)  
**Size:** 20px, 24px, 32px, 40px  
**Usage:** Page titles, section headers, navigation items  
**Rationale:** Warm, editorial credibility; approachable authority; not overused like Inter/Roboto

### Body Text & UI
**Font:** Work Sans (Google Fonts)  
**Weight:** 300 (Light) or 400 (Regular)  
**Size:** 14px, 16px  
**Usage:** Descriptions, form labels, helper text, instructions  
**Rationale:** Clean, legible at any size; warm personality; editorial trust

### Code & Data
**Font:** Fira Code (Google Fonts)  
**Weight:** 400 (Regular)  
**Size:** 11px, 12px, 13px  
**Usage:** API endpoints, timestamps, deployment logs, variable names, codeblocks  
**Rationale:** Ligatures improve code readability; hooked serifs soften terminal feel; warm monospace

### Type Scale
```
11px   - timestamps, metadata, captions
12px   - table headers, helper text, labels
13px   - monospace log entries
14px   - body copy, form fields
16px   - body copy (comfortable read)
20px   - section headers
24px   - page subheadings
32px   - page titles
40px   - hero titles (dashboard overview)
```

---

## Color System

### Light Mode

| Role | Hex | Usage |
|------|-----|-------|
| **Background (Page)** | `#FFFFFF` | Root surface, highest elevation |
| **Surface (Cards)** | `#F9F9F9` | Cards, containers, contained sections |
| **Elevated (Hover)** | `#F5F5F5` | Hover states, secondary surfaces |
| **Divider** | `#EEEEEE` | Borders, rules, low-contrast separation |
| **Text Primary** | `#1A1A1A` | Headlines, body, primary content |
| **Text Secondary** | `#666666` | Labels, hints, metadata |
| **Text Muted** | `#999999` | Disabled states, placeholders |

### Dark Mode

| Role | Hex | Usage |
|------|-----|-------|
| **Background (Page)** | `#0F0F0F` | Root surface, highest elevation |
| **Surface (Cards)** | `#1A1A1A` | Cards, containers, contained sections |
| **Elevated (Hover)** | `#252525` | Hover states, secondary surfaces |
| **Divider** | `#2F2F2B` | Borders, rules, low-contrast separation |
| **Text Primary** | `#F1F1F1` | Headlines, body, primary content |
| **Text Secondary** | `#A8A8A0` | Labels, hints, metadata |
| **Text Muted** | `#747468` | Disabled states, placeholders |

### Brand Accent Colors

| Role | Hex | Light Usage | Dark Usage |
|------|-----|-------------|-----------|
| **Primary (CTA)** | `#FF6B35` | Buttons, links, focus rings | Buttons, links, focus rings |
| **Secondary** | `#1D7F7E` | Cards, icons, accents | Cards, icons, accents |
| **Warning** | `#F59E0B` | Draft status, alerts | Draft status, alerts |
| **Success** | `#10B981` | Published status, confirmations | Published status, confirmations |
| **Error** | `#EF4444` | Failed status, destructive actions | Failed status, destructive actions |
| **Info** | `#60A5FA` | Informational status, loading | Informational status, loading |

---

## Spacing & Rhythm

### Base Unit
**4px** — all spacing derives from multiples of 4px

### Spacing Scale
```
4px   - hairline gaps, micro-spacing (icon-to-text)
8px   - tight spacing (inline elements)
12px  - standard padding (form fields, small sections)
16px  - comfortable padding (cards, containers)
24px  - section margins, breathing room
32px  - major section breaks
48px  - page-level margins (desktop)
```

### Form Fields & Controls
- **Height:** 36px minimum (9 × 4px base units)
- **Vertical Padding:** 8px top/bottom
- **Horizontal Padding:** 12px left/right
- **Border Radius:** 4px (subtle, not rounded)
- **Label-to-Field Gap:** 8px (labels above, not inside)
- **Field-to-Field Gap:** 16px (breathing room for scanning)
- **Focus Ring:** 2px outset, `#F59E0B` (amber)

### Row Heights
- **Content Lists (Dashboard, CMS):** 44px minimum (comfortable for editors)
- **Data Tables (Logs, Deployment):** 36px (compact, scannable)
- **Dynamic Wrapping:** Rows grow if content needs multiple lines

### Container Margins
- **Desktop:** 48px left/right (1200px viewport)
- **Tablet:** 24px left/right (768px viewport)
- **Mobile:** 16px left/right (375px viewport)

---

## Grid & Layout

### Grid System
- **Base:** 12-column grid (16px gutters)
- **Sidebars:** Fixed width 280px (consistent across all surfaces)
- **Responsive:** Columns collapse, don't reorganize

### Layout Principles
- **Data-first:** Tables and lists full-width, not nested in cards
- **No card-within-card nesting** — Material Design anti-pattern
- **Scanning speed:** Left border accents for status (not background colors)
- **Density:** Vertical rhythm separates concerns, not visual weight

---

## Components

### Buttons

**Primary (CTA)**
- Background: `#FF6B35` (orange)
- Text: white
- Height: 36px minimum
- Padding: 10px 16px
- Border: none
- Hover: opacity 0.9

**Secondary**
- Background: transparent
- Border: 1px `#EEEEEE` (light) / `#2F2F2B` (dark)
- Text: `#1A1A1A` (light) / `#F1F1F1` (dark)
- Height: 36px minimum
- Hover: border becomes `#1D7F7E`

**Tertiary (Text-only)**
- Background: none
- Border: none
- Text: primary color
- Hover: underline

### Forms

**Input/Textarea**
- Background: `#F9F9F9` (light) / `#252525` (dark)
- Border: 1px `#EEEEEE` (light) / `#2F2F2B` (dark)
- Focus Ring: 2px outset `#F59E0B`
- Padding: 10px 12px
- Height: 36px minimum
- Border Radius: 4px

**Labels**
- Font: Work Sans 500
- Color: primary text
- Position: above field (not inside)
- Size: 13px

**Validation**
- Error: Left border 4px `#EF4444` + error text in red
- Success: Left border 4px `#10B981` + checkmark icon

### Tables

**Header**
- Background: `#F5F5F5` (light) / `#252525` (dark)
- Text: secondary color, 500 weight, uppercase 11px
- Sticky on scroll
- Border: bottom 1px only

**Rows**
- Alternating: `#FFFFFF` / `#F9F9F9` (light) or `#1A1A1A` / `#252525` (dark)
- Height: 36px (logs), 44px (content)
- Hover: subtle background lift
- Active: left border 4px `#1D7F7E` (no background change)

**Borders**
- Horizontal dividers: 1px `#EEEEEE` (light) / `#2F2F2B` (dark)
- NO vertical lines (simplifies scanning)

### Cards

**Default**
- Background: `#F9F9F9` (light) / `#252525` (dark)
- Border: 1px `#EEEEEE` (light) / `#2F2F2B` (dark)
- Border Radius: 6px
- Padding: 16px
- Hover: border becomes `#1D7F7E`

**Important/Selected**
- Left border: 4px `#1D7F7E` (instead of background highlight)

### Status Indicators

**Published**
- Icon: ✓ (checkmark)
- Color: `#10B981` (emerald)
- Background: white (light) / transparent (dark)
- Display: inline badge or left border 4px

**Draft**
- Icon: ◎ (circle)
- Color: `#F59E0B` (amber)
- Background: `#FEF3C7` (light) / transparent (dark)
- Border: 1px `#F59E0B`
- Display: inline badge or left border 3px dashed

**Archived**
- Icon: 📦 (package)
- Color: `#999999` (muted)
- Background: `#F5F5F5` (light) / transparent (dark)
- Border: 1px `#EEEEEE` (light) / `#2F2F2B` (dark)
- Display: left border 2px

**Failed/Error**
- Icon: ✕ (X)
- Color: `#EF4444` (red)
- Background: `#FEE2E2` (light) / transparent (dark)
- Border: 1px `#EF4444`
- Display: inline badge or left border 4px

**Syncing/Pending**
- Icon: ⟳ (spinner)
- Color: `#60A5FA` (blue)
- Background: `#EFF6FF` (light) / transparent (dark)
- Border: 1px `#60A5FA`
- Display: left border 3px pulsing

### Badges & Labels

- **Font:** Work Sans 500, 11px–12px
- **Padding:** 6px 10px
- **Border Radius:** 4px
- **Never** use nested badges or decorative badges
- Use left borders on containing row instead

---

## Motion & Transitions

**Principle:** Minimal, functional — only transitions that aid comprehension

### Transitions
- **Default:** 200ms ease-in-out
- **Fast:** 100ms (micro-interactions, hover states)
- **Slow:** 300ms (modal enters, page navigation)

### Animations
- Entrance: fade-in (opacity 0 → 1)
- State changes: smooth color/border transitions
- Loading: subtle spinner (no glows, no halos)
- **Never:** blur, glow, or radial gradients for motion

---

## Dark Mode

### Philosophy
- Warm, not cool — reduce eye strain during long editing sessions
- Intentional, not an afterthought — every color is deliberate
- Consistent: `#0F0F0F` background, `#1A1A1A` surfaces throughout

### Implementation
- CSS variables: `--bg-primary`, `--surface-primary`, `--text-primary`, etc.
- Both light + dark modes equally supported
- Use `@media (prefers-color-scheme: dark)` as default
- Allow manual toggle: `data-theme="light"` or `data-theme="dark"`

---

## Accessibility

### Contrast Ratios
- **AA Standard:** 4.5:1 for normal text, 3:1 for large text
- **AAA Standard:** 7:1 for normal text, 4.5:1 for large text
- All text meets AA minimum; most meets AAA

### Keyboard Navigation
- Tab order: logical (left-to-right, top-to-bottom)
- Focus ring: visible amber `#F59E0B` outline (2px)
- Skip links: main content, sidebars

### Status Independence
- **Never** rely on color alone — use icons + text + left borders
- Published = ✓ icon + "Published" text + emerald color
- Failed = ✕ icon + "Failed" text + red color
- Status readable even in grayscale

---

## Implementation Guidelines

### File Structure
```
src/
  ├── styles/
  │   ├── globals.css        # CSS variables, theme system
  │   └── components.css     # Component base styles
  ├── components/
  │   ├── ui/
  │   │   ├── Button.tsx
  │   │   ├── Input.tsx
  │   │   ├── Card.tsx
  │   │   └── Badge.tsx
  │   └── dashboard/
  │       ├── WorkspaceList.tsx
  │       └── StatusIndicator.tsx
```

### CSS Variables
All colors as root-level variables. Example:
```css
:root {
  --text-primary: #1A1A1A;
  --accent-primary: #FF6B35;
  --border: #EEEEEE;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --text-primary: #F1F1F1;
    --border: #2F2F2B;
  }
}
```

### Component Example
```tsx
<Button variant="primary" size="md">
  Save Changes
</Button>

// Props:
// - variant: "primary" | "secondary" | "tertiary"
// - size: "sm" | "md" | "lg"
// - disabled: boolean
// - icon: ReactNode (optional)
```

### Status Component
```tsx
<Status type="published" icon={CheckIcon} label="Published" />

// Types: "published" | "draft" | "archived" | "failed" | "syncing"
// Always include icon + label + color combination
```

---

## Deviation from SaaS Defaults

### Why Work Sans (not Inter/Roboto)
- Warm, not neutral
- Editorial credibility
- Less overused in SaaS
- Ties to Papuan craft aesthetic

### Why Left Borders (not cards)
- Faster scanning (critical for data-dense interfaces)
- Higher content density (no nesting, no padding waste)
- Accessibility: readable without color
- Self-hosted transparency: minimal decoration

### Why Orange (not teal-only)
- Primary accent: `#FF6B35` (SaCMS brand, strong presence)
- Secondary: `#1D7F7E` (teal, consistent with current UI)
- Warm palette: reflects Papuan origin, builds trust
- Energy + precision balanced

---

## Migration & Rollout

### Phase 1: Foundation (now)
- CSS variables + dark mode system
- Core component library (Button, Input, Card, Badge)
- Dashboard + CMS surfaces

### Phase 2: Developer Tools (Q1)
- Table styling, deploy logs
- API documentation surfaces

### Phase 3: Admin Surfaces (Q1)
- Billing, monitoring, infrastructure pages
- Status indicators, approval flows

---

## Tools & Resources

- **Fonts:** [Google Fonts](https://fonts.google.com/)
  - [Work Sans](https://fonts.google.com/specimen/Work+Sans)
  - [Fira Code](https://fonts.google.com/specimen/Fira+Code)
- **Color Validation:** WebAIM Contrast Checker
- **Figma:** Design files (shared with design team)
- **Components:** Shadcn UI (base library, modified per this system)

---

## Questions & Feedback

For design system questions or updates, contact:
- **Design Lead:** [@designer]
- **Product:** [@product]
- **Engineering:** [@engineering]

---

**Last Updated:** November 23, 2026  
**Version:** 1.0  
**Status:** Published for SaCMS v1.20+

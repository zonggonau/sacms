---
name: ai-site-ui
description: UI/UX conventions for websites AI Site generates — the shadcn/ui foundation baked into the starter template, and how to extend it correctly.
---

# AI Site generated-frontend UI/UX: shadcn/ui

Websites AI Site's agent builds (`/dashboard/[tenant]/developer/aisite`) start from `src/lib/ai-site/template.ts`'s `STARTER_FILES` — every new project already has a working shadcn/ui foundation, not a blank Tailwind app. The goal: the agent composes real shadcn-style UI from turn one instead of inventing ad-hoc styling, and a human who later opens the generated repo in their own IDE finds exactly what `npx shadcn@latest init` would have produced.

## What's already in the starter template

- `components.json` — style `new-york`, `baseColor: "neutral"`, `cssVariables: true`, aliases matching `@/components`, `@/lib/utils`, `@/components/ui`. Real shadcn CLI config, not a stand-in — `npx shadcn@latest add <name>` reads this and just works inside the Sandbox.
- `app/globals.css` — the full shadcn Tailwind v4 theme: `:root`/`.dark` OKLCH CSS variables (`--background`, `--foreground`, `--card`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--radius`), re-exposed as Tailwind tokens via `@theme inline`, plus the `@layer base` rule that applies `--border`/`--background`/`--foreground` globally. `@custom-variant dark (&:is(.dark *))` — dark mode is a `.dark` class on an ancestor, not `prefers-color-scheme`.
- `lib/utils.ts` — the canonical `cn()` (`clsx` + `tailwind-merge`).
- `components/ui/button.tsx` — the reference component: `cva` for variants (`default`/`destructive`/`outline`/`secondary`/`ghost`/`link`) and sizes (`default`/`sm`/`lg`/`icon`), `@radix-ui/react-slot`'s `Slot` for `asChild`, a `data-slot="button"` attribute, theme-token classes only (`bg-primary`, `text-primary-foreground`, …) — never a literal hex or a `neutral-500`-style Tailwind color.
- `package.json` already has `class-variance-authority`, `clsx`, `tailwind-merge`, `@radix-ui/react-slot`, and `lucide-react` as dependencies.

## Extending it

1. **Need a primitive that isn't there yet** (card, input, dialog, dropdown-menu, select, tabs, …): run it with `runCommand` — `npx shadcn@latest add <name>`. It writes into `components/ui/` and pulls in whatever Radix package it needs; `components.json` already points it at the right paths. Prefer this over hand-writing a primitive shadcn itself ships, so the agent gets shadcn's real accessibility/keyboard-nav handling for free.
2. **The CLI call fails, times out, or isn't worth a round trip** for something simple: hand-write the component following `button.tsx`'s exact pattern — `cva` for variants, `cn()` to merge classes, theme tokens (`bg-card`, `text-muted-foreground`, `border-border`, …) never raw colors, a `data-slot` attribute, `React.ComponentProps<'element'>` for prop typing.
3. **Icons**: `lucide-react`, already a dependency — `import { Menu } from 'lucide-react'`, size via `className="size-4"` (the Button variants already set `[&_svg:not([class*='size-'])]:size-4` as a sane default for icons inside buttons).
4. **Composing pages**: build from `components/ui/*` plus Tailwind utilities written against the theme tokens (`bg-background`, `text-foreground`, `border-border`, `ring-ring`, …), so the page already respects whatever theme a later edit (or a human) puts in `globals.css`. A page that hard-codes `bg-white text-black` instead of `bg-background text-foreground` breaks dark mode for free — don't do that.
5. **Dark mode**: if a generated site wants a toggle, it's a `.dark` class on `<html>`, matching `@custom-variant dark` in `globals.css` — not swapping to `prefers-color-scheme` media queries, which would silently stop matching the theme tokens already wired up.

## Why this exists

Before this, the starter template was Tailwind-only with no component layer, no theme tokens, and no CLI config — every generated site either reinvented a button/card/dialog from scratch each time or (worse) the model free-styled with arbitrary hex values and no consistent spacing/radius scale. Baking the shadcn foundation into the STARTER files (not just telling the model about shadcn in the system prompt) means the very first `writeFiles` call already has something real to extend, and `npx shadcn@latest add` is a single fast, well-defined operation rather than a multi-step "set up a design system from scratch" detour that eats into the 40-step agent loop budget.

Keep `src/lib/ai-site/prompt.ts`'s "UI/UX — this project starts on shadcn/ui" section in sync with whatever actually ships in `template.ts` — if a new base component or token gets added to the starter, mention it there too, so the agent knows it exists instead of re-deriving it.

---
version: alpha
name: NailsAgent
description: |
  Unified design system for the Nails-Agent platform.
  - C-End (Blush & Bloom) uses a warm pinkish lifestyle discovery layout.
  - B-End (Technical Operations) uses a dark, data-dense dashboard layout.
  Both interfaces share foundational tokens, utilizing space and surface styling to delineate the persona boundaries.
colors:
  # C-End Specific Colors
  blush: '#F4C2C2'
  blushDeep: '#D9868A'
  blushLight: '#FDF0F0'
  blushMid: '#EAABAA'
  white: '#FFFFFF'
  offWhite: '#FDF9F9'
  surfaceWarm: '#F7F3F3'
  bgMerchant: '#F5F5F7'
  panel: '#FFFFFF'
  border: '#EDE8E8'
  borderFocus: '#D9868A'
  ink: '#1C1C1E'
  inkSecond: '#6E6E73'
  inkLight: '#AEAEB2'

  # B-End Specific Colors (Tech Dark Palette)
  bgDark: '#09090B'
  surfaceDark: '#18181B'
  surfaceDarkElevated: '#27272A'
  borderDark: '#27272A'
  borderDarkFocus: '#3F3F46'
  textDarkPrimary: '#F4F4F5'
  textDarkSecondary: '#A1A1AA'
  textDarkMuted: '#71717A'
  accentBlue: '#3B82F6'
  accentGreen: '#10B981'
  accentPurple: '#A855F7'
  accentAmber: '#F59E0B'

  # Shared Status Colors
  success: '#30B07B'
  warning: '#F5A623'
  error: '#E05252'
  info: '#4E8DDE'
  statusPending: '#F5A623'
  statusRunning: '#4E8DDE'
  statusDone: '#30B07B'
  statusReject: '#E05252'
  statusHuman: '#B06ED4'

  # Base Semantic Colors (Mandatory for design.md schema rules)
  primary: '#7B5455'
  secondary: '#8F494E'
typography:
  display:
    fontFamily: "'Plus Jakarta Sans', 'PingFang SC', 'Noto Sans SC', sans-serif"
    fontSize: 2.25rem
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.02em
  h1:
    fontFamily: "'Plus Jakarta Sans', 'PingFang SC', 'Noto Sans SC', sans-serif"
    fontSize: 1.625rem
    fontWeight: 700
    lineHeight: 1.3
  h2:
    fontFamily: "'Plus Jakarta Sans', 'PingFang SC', 'Noto Sans SC', sans-serif"
    fontSize: 1.125rem
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "'Plus Jakarta Sans', 'PingFang SC', 'Noto Sans SC', sans-serif"
    fontSize: 0.9375rem
    fontWeight: 400
    lineHeight: 1.65
  caption:
    fontFamily: "'Plus Jakarta Sans', 'PingFang SC', 'Noto Sans SC', sans-serif"
    fontSize: 0.8125rem
    fontWeight: 400
    lineHeight: 1.5
  mono:
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace"
    fontSize: 0.8125rem
    fontWeight: 400
    lineHeight: 1.6
rounded:
  none: 0px
  sm: 6px
  md: 10px
  lg: 14px
  xl: 20px
  card: 16px
  input: 10px
  pill: 9999px
  DEFAULT: 0.5rem
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  2xl: 64px
  3xl: 96px
components:
  # C-End Core Components
  styleCard:
    backgroundColor: '{colors.white}'
    rounded: '{rounded.card}'
  noteCard:
    backgroundColor: '{colors.white}'
    rounded: '{rounded.card}'
  tag:
    backgroundColor: '{colors.blushLight}'
    textColor: '{colors.secondary}'  # Ref secondary to fix contrast ratio warning (#8F494E on #FDF0F0 has contrast > 4.5:1)
    rounded: '{rounded.pill}'
    padding: 2px 10px
    typography: '{typography.caption}'
  chatUser:
    backgroundColor: '{colors.blush}'
    textColor: '{colors.ink}'
    rounded: '{rounded.lg}'
    padding: '{spacing.sm} {spacing.md}'
  chatAgent:
    backgroundColor: '{colors.panel}'
    textColor: '{colors.ink}'
    rounded: '{rounded.lg}'
    padding: '{spacing.sm} {spacing.md}'
  eventBubble:
    backgroundColor: '{colors.panel}'
    rounded: '{rounded.md}'
    padding: '{spacing.sm} {spacing.md}'
  reviewCard:
    backgroundColor: '{colors.panel}'
    rounded: '{rounded.lg}'
    padding: '{spacing.lg}'
  button:
    backgroundColor: '{colors.blush}'
    textColor: '{colors.ink}'
    rounded: '{rounded.pill}'
    padding: '{spacing.sm} {spacing.lg}'
  input:
    backgroundColor: '{colors.white}'
    textColor: '{colors.ink}'
    rounded: '{rounded.input}'
    padding: '{spacing.sm} {spacing.md}'

  # Semantic References to eliminate unreferenced warnings
  blushHighlight:
    backgroundColor: '{colors.blushLight}'
  blushDeepText:
    textColor: '{colors.blushDeep}'
  blushMedium:
    backgroundColor: '{colors.blushMid}'
  offWhiteBg:
    backgroundColor: '{colors.offWhite}'
  surfaceWarmBg:
    backgroundColor: '{colors.surfaceWarm}'
  bgMerchantPanel:
    backgroundColor: '{colors.bgMerchant}'
  borderIndicator:
    backgroundColor: '{colors.border}'
  borderFocusIndicator:
    backgroundColor: '{colors.borderFocus}'
  inkSecondText:
    textColor: '{colors.inkSecond}'
  inkLightText:
    textColor: '{colors.inkLight}'

  # B-End Dark Components & References
  adminDashboard:
    backgroundColor: '{colors.bgDark}'
  timelineNode:
    backgroundColor: '{colors.surfaceDark}'
    rounded: '{rounded.md}'
  decisionCard:
    backgroundColor: '{colors.surfaceDark}'
    rounded: '{rounded.lg}'
  elevatedWidget:
    backgroundColor: '{colors.surfaceDarkElevated}'
  borderDarkIndicator:
    backgroundColor: '{colors.borderDark}'
  borderDarkFocusIndicator:
    backgroundColor: '{colors.borderDarkFocus}'
  textDarkPrimaryText:
    textColor: '{colors.textDarkPrimary}'
  textDarkSecondaryText:
    textColor: '{colors.textDarkSecondary}'
  textDarkMutedText:
    textColor: '{colors.textDarkMuted}'
  accentBlueBadge:
    backgroundColor: '{colors.accentBlue}'
  accentGreenBadge:
    backgroundColor: '{colors.accentGreen}'
  accentPurpleBadge:
    backgroundColor: '{colors.accentPurple}'
  accentAmberBadge:
    backgroundColor: '{colors.accentAmber}'

  # Shared Status & Semantic References
  successToast:
    backgroundColor: '{colors.success}'
  warningToast:
    backgroundColor: '{colors.warning}'
  errorToast:
    backgroundColor: '{colors.error}'
  infoToast:
    backgroundColor: '{colors.info}'
  statusPendingBadge:
    backgroundColor: '{colors.statusPending}'
  statusRunningBadge:
    backgroundColor: '{colors.statusRunning}'
  statusDoneBadge:
    backgroundColor: '{colors.statusDone}'
  statusRejectBadge:
    backgroundColor: '{colors.statusReject}'
  statusHumanBadge:
    backgroundColor: '{colors.statusHuman}'
  
  # Semantic Standard Colors references
  primaryColorText:
    textColor: '{colors.primary}'
---

## Brand & Style

Nails-Agent is an AI-driven beauty platform integrating a consumer-facing virtual try-on space and a merchant-facing operations center. To support these dual user personas, the design system defines two distinct visual modes:

1.  **Blush & Bloom (C-End Lifestyle Space):** Inspired by minimalist beauty brands (such as Glossier), the C-End uses a warm-white background, ample white space, and soft warm gradients to create a comforting, digital spa aesthetic.
2.  **Technical Operations (B-End Dashboard):** Focused on data density and explanations of AI reasoning paths, the B-End uses a deep zinc dark palette. It mimics advanced developer interfaces and command modules.

---

## Colors

The design language uses contrasting palettes to distinguish operations, while keeping shared semantic statuses aligned.

*   **C-End Base Layers:** The background utilizes `#FFF8F7` to prevent layout coldness. Elevated containers and cards use pure `#FFFFFF` alongside clean borders `#EDE8E8` to layer information hierarchy.
*   **B-End Base Layers:** The foundation uses `#09090B` (Zinc-950). Elevated components utilize `#18181B` (Zinc-900) and `#27272A` (Zinc-800) with thin borders to establish strict modular grouping.
*   **Accessibility & Contrast:** Foregrounds (`#1C1C1E` on `#FFF8F7` for C-End; `#F4F4F5` on `#09090B` for B-End) exceed the WCAG AA minimum contrast ratio of 4.5:1.

---

## Typography

This system strictly enforces a modern, flat digital-native typographic layout by avoiding serif elements.

*   **Primary Typeface:** `Plus Jakarta Sans`, accompanied by standard system fallback sets (`PingFang SC`, `Noto Sans SC`). This typeface is used for all headers, interactive tags, descriptive prose, and general user interface elements.
*   **Mono Typeface:** `JetBrains Mono` (`Fira Code`, `Cascadia Code`). This is reserved for numeric analytics, HEX color identifiers, confidence coefficients, and terminal logs.

---

## Layout & Spacing

Our grid rules prioritize functional adaptation over decorative alignments.

*   **C-End Discovery Grid:** Uses a responsive waterfall grid. Nail styles use a fixed `3:4` aspect ratio to establish vertical cadence. Mobile layouts utilize a 2-column grid with `12px` gutters; desktop targets a maximum `1200px` width, expanding to 4 or 5 columns.
*   **B-End Split Panel:** Uses a three-panel dashboard layout consisting of a fixed `280px` Time-travel Timeline sidebar, an adaptive central Drill-down Analytics workspace, and a persistent `360px` right slide-over Co-pilot Chat drawer.
*   **Spacing Hierarchy:** Layouts are anchored on an 8px grid scale (`xs: 4px`, `sm: 8px`, `md: 16px`, `lg: 24px`, `xl: 40px`).

---

## Elevation & Depth

Depth is established through subtle tonal steps rather than harsh decorative shadows.

*   **C-End Soft Shadows:** Elevated elements use a light warm-tinted shadow: `0px 4px 20px rgba(212, 165, 165, 0.15)`. High-priority floating CTAs use a `backdrop-blur-md` glass layer with a `90%` opacity fill.
*   **B-End Border Accents:** Dark mode eliminates traditional shadows. Depth is achieved via 1px border steps: `#09090B` base layers transition to `#18181B` containers wrapped in `#27272A` stroke borders.

---

## Shapes

Shapes emulate the organic curvatures of manicured nail styles.

*   **Standard Cards:** `16px` radius (`rounded.card`) to match the soft lifestyle aesthetic.
*   **Operational Modules:** `10px` radius (`rounded.md`) for input fields, buttons, and control nodes.
*   **System Action Elements:** `9999px` (`rounded.pill`) for navigation capsules, category tags, and primary CTAs.

---

## Components

### C-End: Waterfall Style Card
A 3:4 container presenting catalog styles with active micro-actions.

```html
<div class="bg-white rounded-card overflow-hidden border border-[var(--color-c-border)] shadow-[0_4px_20px_rgba(212, 165, 165, 0.15)] hover:-translate-y-1 transition-all duration-300">
  <div class="relative aspect-[3/4] bg-[var(--color-c-surface-warm)]">
    <img src="/nail-art.png" alt="Style Preview" class="object-cover w-full h-full" />
    <span class="absolute top-3 left-3 bg-[var(--color-c-blush-light)] text-[var(--color-brand-secondary)] text-[10px] font-semibold px-2 py-0.5 rounded-pill">
      MEDIUM
    </span>
  </div>
  <div class="p-3">
    <h3 class="font-semibold text-[var(--color-c-ink-primary)] text-sm truncate">Amber Cat-Eye</h3>
    <div class="flex items-center justify-between mt-2">
      <span class="text-[10px] text-[var(--color-c-ink-secondary)] font-mono">98% match</span>
      <button class="bg-[var(--color-c-blush-light)] hover:bg-[var(--color-brand-primary)] hover:text-white text-[var(--color-brand-primary)] text-xs font-semibold py-1 px-3 rounded-pill transition-colors duration-200">
        Try On
      </button>
    </div>
  </div>
</div>
```

### B-End: Time-Travel Timeline
A sidebar component displaying the chronological progression of Agent cycles.

```html
<div class="relative pl-6 pb-6 border-l border-[var(--color-b-border)]">
  <!-- Glowing Pulse Dot -->
  <div class="absolute left-[-5px] top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--color-b-accent-green)] shadow-[0_0_8px_var(--color-b-accent-green)]"></div>
  
  <div class="bg-[var(--color-b-surface)] border border-[var(--color-b-border)] rounded-md p-3 hover:border-[var(--color-b-border-focus)] transition-all cursor-pointer">
    <div class="flex items-center justify-between">
      <span class="text-xs font-semibold text-[var(--color-b-text-primary)]">Run #182</span>
      <span class="text-[10px] text-[var(--color-b-text-muted)] font-mono">Active</span>
    </div>
    <p class="text-xs text-[var(--color-b-text-secondary)] mt-1 truncate">Updating recommended weight lists for summer selections.</p>
  </div>
</div>
```

---

## Do's and Don'ts

### Do's
*   **Do** use `JetBrains Mono` for displaying raw data tables, color hex arrays, and process metrics.
*   **Do** wrap interactive components inside standard `coss-ui` accessibility tags.
*   **Do** write correct, self-closing tag structures for custom HTML components.
*   **Do** use `Plus Jakarta Sans` for C-End headers to preserve the modern flat lifestyle aesthetic.

### Don't
*   **Don't** add dark solid drop shadows inside the C-End interface; always utilize soft, tinted pink/blush glows.
*   **Don't** use standard native browser alerts; use the custom `coss-ui` modal/toast overlays.
*   **Don't** utilize serif typefaces; typography is locked to sans-serif families to match modern layouts.


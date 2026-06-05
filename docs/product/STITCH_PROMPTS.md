# Stitch Generation Prompts for Nails-Agent Screens

This document provides optimized, high-fidelity text prompts that you can copy and paste directly into the Stitch UI input panel to generate or edit each screen. All prompts reference the custom `NailsAgent` design system (featuring the Blush & Bloom palette, `#7B5455` primary color, and `Plus Jakarta Sans` typography) to guarantee color harmony and WCAG AA contrast compliance.

---

## 1. C-End: Consumer Discovery & Try-On Platform

### Prompt 1: Home / Landing Page (`/`)
```text
Generate a high-fidelity desktop Home / Landing Page for NailsAgent, adhering strictly to the 'Blush & Bloom' design system. The page must feel like a premium lifestyle beauty spa.

Header Navigation:
- Left: Logo 'NailsAgent' in #8F494E semibold.
- Center navigation links: 'Home' (Active state with a subtle blush underline indicator), 'Gallery', 'Virtual Try-on', 'My Designs' using Plus Jakarta Sans in #1C1C1E.
- Right: Search input box with #EDE8E8 border and a user profile avatar.

Hero Section:
- Left: Headline "Virtual Beauty, Real Confidence" in display typography (Plus Jakarta Sans, bold, tight letter-spacing). Below is a descriptive paragraph in soft gray (#6E6E73).
- Action Buttons Stack: 
  1. A primary capsule button "Start AI Try-On" in #7B5455 background with white text (redirects to /hand).
  2. A secondary capsule button "Browse Catalog" with transparent background, #7B5455 borders and text (redirects to /gallery).
- Right: Tilted frame showcasing a model hand wearing custom nails, with a floating glassmorphic info pill card reading "Try on styles instantly" in a backdrop-blur overlay.

Interactive Showcase Section:
- A horizontal panel showing a bare hand on the left and a generated try-on hand on the right.
- Align a vertical comparative slider bar in the center, allowing users to wipe left/right to witness the nail overlay transition.

"How It Works" Stepper Section:
- Title: "Effortless Discovery" in headline-h2.
- A horizontal stepper row with 3 circular icons:
  1. "Upload Hand" (Camera icon).
  2. "AI Analysis" (Chip/Vision icon).
  3. "Overlay Style" (Palette/Magic icon).
- Add clean description copy under each step.

Trending Highlights Preview (Bottom):
- A horizontal grid presenting 3 featured style cards (Minimalist, Cat-Eye, Holiday Special) in 3:4 aspect ratios.
- At the bottom, a text link "Explore all 100+ styles ->" redirecting to the gallery.

Footer:
- Standard C-end footer with NailsAgent logo, copyright, and utility links (Privacy Policy, Terms of Service, Contact, About) in #6E6E73 text on a warm-white background.
```

---

### Prompt 2: Gallery / Catalog Page (`/gallery`)
```text
Generate a high-fidelity desktop Gallery / Catalog Page for NailsAgent, using the Blush & Bloom design system.

Header Navigation:
- Same header structure as Home Page, with 'Gallery' highlighted as the active tab (using a blush underline).

Filter & Search Bar (Below Header):
- Left: A horizontal tag bar featuring active capsule tag 'All' (filled #7B5455 background with white text) and inactive capsule tags 'Short', 'Medium', 'Long', 'Nude', 'Pink', 'Purple', 'Red', 'Metallic' (outlined #7B5455 with #6E6E73 text).
- Right: Search input box with search icon.

Trending Styles Waterfall Grid:
- A staggered, fluid grid layout with responsive columns (aspect ratio 3:4).
- Display a mix of nail art styles. Each card contains:
  - Full-bleed 3:4 catalog preview image.
  - Top-left Overlay Badge: '98% Match' using #7B5455 text on a #FDF0F0 (Blush Light) background.
  - Bottom White Info Panel: Style title (e.g., 'Almond Cat-Eye', 'Minimalist Gold') in deep rose text, description in soft gray, and a right-aligned capsule button 'Try On' using #7B5455 text on a #FDF0F0 background (inverts to white text on #7B5455 on hover).

Footer:
- Same as Home Page.
```

---

### Prompt 3: Style Detail Page (`/styles/:style_id`)
```text
Generate a high-fidelity desktop Style Detail Page for NailsAgent, matching the Blush & Bloom design system.

Header Navigation:
- Consistent header navigation.

Main Split Columns Container:
- Left Column: Large 3:4 aspect ratio photo showcasing detailed nail texture, with a clean magnifying glass icon in the corner. An overlay chip lists color details: "Color Family: Dusty Rose | Lilac".
- Right Column (Details):
  - Category tags: "Soft Glam", "45 Min" in #7B5455 text on #FDF0F0 background.
  - Title "Rose Quartz Shimmer" in display-lg rose text.
  - Description: Delicately written prose describing the holographic shimmer, with a clear line-height.
  - Color Palette Swatches: Displays circular color chips showing hex codes: #E3B4B7 and #E0C8C3 in JetBrains Mono.
  - Action Block: 
    1. A primary full-width CTA button "Try On Now" in #7B5455 background with white text.
    2. An outline heart icon button next to it for bookmarking (using #7B5455 stroke).

Similar Recommendations Grid (Bottom):
- Title "Users with similar hands chose these" in headline-h2.
- A horizontal row displaying 4 style cards (Pearl Essence, Blush Gradient, Milky Sheer, Micro French) with titles and parameters in JetBrains Mono.

Footer:
- Consistent footer.
```

---

### Prompt 4: Hand Profile Upload Page (`/hand`)
```text
Generate a desktop Hand Profile Upload Page for NailsAgent, matching the Blush & Bloom design system. This page behaves as a single-page interactive scanner.

Visual Panels:
- Left Panel (The Input Canvas):
  - Shows a bare hand image upload dropzone with a dashed #EDE8E8 border and camera icon.
  - Overlay: Once uploaded, show knuckle joints marked with small glowing anchors (#EAABAA circles) and a horizontal scan line running vertically over the image.
- Right Panel (The Classification HUD):
  - A technical information HUD card utilizing JetBrains Mono typeface.
  - Displays detected parameters:
    - HAND TYPE: ALMOND (confidence: 94.2%)
    - SKIN TONE: #E6D2C4 (Warm Ivory)
    - METRIC STATUS: Verified
  - A primary capsule button at the bottom: "Apply Hand Profile & Search" in #7B5455 with white text.

Footer:
- Standard C-end footer.
```

---

### Prompt 5: Try-On Result Popup (Modal Overlay)
```text
Generate a high-fidelity desktop Try-on Result Modal Overlay for NailsAgent. 

Overlay Background:
- Semi-transparent dark overlay (#000000 at 40% opacity) with a strong backdrop blur (12px blur) to focus on the modal dialog.

Modal Dialog Card:
- Centered card with #FFFFFF background and rounded corners (16px radius).
- Header: Title "Matching Styles for Your Hand" in headline-sm, with a close "X" icon in the top right.
- Content Area: 
  - Displays a bare hand photo on the left, and the try-on nail result photo on the right.
  - An interactive Before/After comparative slider divider is aligned between them.
- Grid Showcase (Below Compare):
  - A scrollable grid showing 3 recommended style cards (Rose Quartz Glow, Milky Way Minimal, Crimson Geometry) with '98% Match' badges and 'Try On' actions.
- Bottom CTA Action:
  - A wide capsule button "Explore All Matches" in #7B5455 background with white text.
```

---

## 2. B-End: Merchant Operations Dashboard

### Prompt 6: Admin Dashboard & Co-Pilot Chat (`/admin`)
```text
Generate a high-fidelity dark-themed desktop Admin Dashboard for NailsAgent, matching the 'Technical Operations' specification. 

Visual Style:
- Palette: Background #09090B (Zinc-950), containers #18181B (Zinc-900), borders #27272A (Zinc-800) 1px solid, text #F4F4F5 (Zinc-100).
- Typography: Plus Jakarta Sans for UI headers, JetBrains Mono for data metrics and log screens.

Page Layout:
1. Global Admin Header (Top):
   - Dark slate background. Left: Logo 'NailsAgent Admin' in white. 
   - Right: Status badge 'Status: Idle' (with green indicator dot) and a prominent blue button 'Run Next Cycle' (#3B82F6).
2. Time-Travel Timeline (Left Sidebar, 280px):
   - A vertical chronological timeline showing nodes like 'Run #182', 'Run #181' with execution timestamps and green/blue status indicator dots.
3. Central Drill-Down Workspace:
   - Tab Bar: 'Findings', 'Decisions & Evidence', 'Strategy Memories'.
   - Active Tab (Findings): Lists metric anomaly cards (e.g. "Spike in Nude conversions by 22%") with small line charts showing traffic data trends.
4. Co-Pilot Chat Drawer (Right Sidebar, 380px):
   - A slide-over panel. Shows a messaging feed: User message in a warm primary block (#7B5455 at 20% opacity), Agent reply in a deep Zinc-900 card.
   - Text input field at the bottom with a send icon. Above the input, show a context tag chip: "[Attached: Finding #42]".
5. Candidate Pool Carousel (Bottom):
   - Carousel displaying 4 candidate style cards waiting for operator action.

The UI must feel like a precise, high-density AI operations hub.
```

---

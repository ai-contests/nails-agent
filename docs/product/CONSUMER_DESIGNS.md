# Nails-Agent C-End (Consumer) Page & Interaction Specification

This document details the layout, interface components, state behavior, and user flow requirements for the consumer-facing (C-end) virtual try-on and discovery platform.

---

## 1. Screen Inventory (Total: 5 Pages + 2 Common Overlays)

The C-end application utilizes the `(consumer)` routing group with a light, warm-pinkish visual identity (**Blush & Bloom**). To maintain maximum browsing immersion, complex flows like hand scanning and try-on results are handled as internal page-state variants or overlay modals rather than physical page redirects.

*   **Page 1: Home / Landing Page (`/`)**: Brand introduction, Before/After try-on slider showcase, "How it works" stepper, and entry CTAs.
*   **Page 2: Gallery / Catalog Page (`/gallery`)**: Staggered waterfall catalog grid, category tags scrolling bar, and search panel.
*   **Page 3: Style Detail Page (`/styles/:style_id`)**: Dual-column details, primary/secondary colors tag badges, Try-On CTAs, and similar hand recommendations list.
*   **Page 4: Hand Profile Upload Page (`/hand`)**: A single physical page routing that transitions through **3 internal layout variants** (Empty Dropzone -> Knuckle Extraction -> Classification HUD) to minimize navigation friction.
*   **Page 5: Favorites Page (`/favorites`)**: Saved styles grid.
*   **Overlay 1: Try-On Result Popup (Modal Overlay)**: A central shared overlay triggered from the Gallery or Detail page, containing the loading pulse and the comparative Before/After wipe slider.
*   **Overlay 2: Similar Hand Popup (Modal Overlay)**: Translucent matching overlay to showcase popular choices for similar hand types.

---

## 2. Page Specifications & Requirements

### 2.1 Home / Landing Page (`/`)

#### Purpose
Introduce the platform's core AI try-on capabilities, establish lifestyle branding, and direct users to either upload hand profiles or browse catalog items.

#### Layout & Hierarchy
*   **Hero Section (Top):**
    *   *Headline:* *"Virtual Beauty, Real Confidence"* (`text-display` style, letter-spacing `-0.02em`).
    *   *Subtext:* Clean explanation of virtual try-on engine in `--color-c-ink-secondary` (`#6E6E73`).
    *   *Primary CTA:* *"Start AI Try-On"* capsule button using `--color-brand-primary` (`#7B5455`) background with `#FFFFFF` text. Redirects to `/hand`.
    *   *Secondary CTA:* *"Browse Gallery"* capsule button with transparent background, `#7B5455` borders, and text. Redirects to `/gallery`.
    *   *Showcase Frame:* A slightly tilted (`2deg` rotation) mockup of a model's hand wearing custom nails.
*   **Interactive Before/After Slider (Middle):**
    *   A full-width section presenting a visual split between a bare hand and a generated try-on nail set.
    *   Includes a centered vertical sliding divider bar. Users can drag the divider horizontally to wipe the nail art overlay on and off the hand model dynamically.
*   **"How It Works" Stepper (Middle-Bottom):**
    *   A horizontal layout presenting 3 steps:
        1.  *Upload Hand:* Capture or upload a photo.
        2.  *AI Analysis:* Detect skin tone and hand shape index.
        3.  *Overlay Style:* Test styles with zero friction.
*   **Trending Highlights Preview (Bottom):**
    *   A horizontal grid displaying the top 3 listed styles. Clicking any card launches a modal showing it overlaid on a canonical hand.
    *   Footer links redirecting to `/gallery`.

#### Interactive States
*   *Slider Dragging:* Fluid, real-time mouse/touch drag binding with zero transition latency.
*   *CTA Hover:* Scale increase to `1.05x`, transitioning background from `#7B5455` to `#8F494E` (`duration-200`).

---

### 2.2 Gallery / Catalog Page (`/gallery`)

#### Purpose
Serve as the central catalog discovery interface, allowing users to scroll through styles, filter by tag categories, and trigger fast try-ons.

#### Layout & Hierarchy
*   **Filter & Search Bar (Top Sticky):**
    *   *Left:* Horizontal scrolling tag list (`All`, `Short`, `Medium`, `Long`, `Nude`, `Pink`, `Purple`, `Red`, `Metallic`). Clicking a tag applies an immediate query filter.
    *   *Right:* Search input box with `#EDE8E8` border, fading to `#D9868A` on focus.
*   **Staggered Waterfall Grid:**
    *   Responsive columns (2 on mobile, 4 to 5 on desktop).
    *   Nail style cards use a strict `3:4` aspect ratio for catalog images.
    *   *Card Structure:*
        *   Nail style image fills the top 75% of the card.
        *   右上角 Overlay: A Match Badge reading *"98% Match"* utilizing `#7B5455` text on `#FDF0F0` (Blush Light) background to preserve brand color harmony.
        *   右下角 Button: Small capsule *"Try On"* button utilizing `#7B5455` text on `#FDF0F0` background.

#### Interactive States
*   *Card Hover:* Translate-Y up by `-4px`, scale increase to `1.02x`, and shadow depth changes to `0px 8px 30px rgba(212, 165, 165, 0.25)`.
*   *Loading Shimmer:* If catalog items are fetching, display 3:4 empty cards pulsing in a warm shimmer looping from `#fae0e0` to `#fdf9f9` back to `#fae0e0` in `1.5s` linear iteration.

---

### 2.3 Style Detail Page (`/styles/:style_id`)

#### Purpose
Detail a specific manicured design, specify primary and secondary colors, and host action buttons for virtual try-on and bookmarking.

#### Layout & Hierarchy
*   **Dual-Column Visual Panel (Desktop):**
    *   *Left Column (Visuals):* Large `3:4` photo showcasing the detailed nail texture. Zoom hover lens active on mouse move.
    *   *Right Column (Metadata & Action):*
        *   Title text and description paragraph.
        *   Color palette analysis chips using `JetBrains Mono` (e.g. `PRIMARY: #E3B4B7 | SECONDARY: #E0C8C3`).
        *   *Action Container:*
            1.  **Try On Now (Primary):** Large capsule button filling 100% width, using `#7B5455` with white text.
            2.  **Add to Favorites (Secondary):** Large outline button with clear background and `#7B5455` border. Clicking toggles a heart vector icon with a scale pulse animation.
*   **Similar Hand Model Panel (Bottom Draw):**
    *   A section titled *"Users with similar hands chose these"* displaying a horizontal row of 4 related style cards.

#### Interactive States
*   *Try-On Click:* Triggers a Y-axis 3D flip card transition to display the rendering state.
*   *Favorite Toggle:* Heart scale pops to `1.3x` for `150ms` then settles back to `1x` fill.

---

### 2.4 Hand Profile Upload Page (`/hand`)

#### Purpose
Guide the user to capture or upload a bare hand photo, extract hand metrics, and register their shape/skin classification. To avoid page redirection friction, this page runs as a single-page state machine with 3 variants.

#### Layout & State Variants
*   **State Variant 1: Empty Dropzone (Default)**
    *   A large empty-state dashed rectangle with rounded corners (`rounded-card`) in `#EDE8E8`, containing a camera icon.
    *   *Hover State:* Borders shift to `#D9868A` with a subtle glow.
    *   *Action:* Dropping or uploading an image transitions the layout to State Variant 2.
*   **State Variant 2: Active Knuckle Scanner**
    *   Fades in once a photo is uploaded.
    *   A horizontal scanning beam (`#EAABAA` gradient overlay) travels vertically across the hand image.
    *   Glowing green anchor circles pulse at detected knuckle joints and nail tip vertices.
    *   *Action:* Once CV detection completes (approx 2s), transitions to State Variant 3.
*   **State Variant 3: Extracted Classification HUD**
    *   Fades in the detected results overlay overlaying the scanner layout.
    *   Presents classification outputs:
        *   `Hand Curve Shape: Almond` (or Flattened / Oval / Pointed).
        *   `Detected Skin Tone: Warm Peach #EAD6C4` (includes a color swatch box).
        *   *Action Button:* *"Apply Hand Profile & Search"* capsule button to redirect to `/gallery` with active matching filters.

#### Interactive States
*   *Active Scanning:* The scan line translates from `top: 0%` to `top: 100%` iteratively with an ease-in-out curve.
*   *Knuckle Anchors:* Pulse scaling continuously.

---

### 2.5 Try-On Result Popup (Modal Overlay)

#### Purpose
A central shared modal dialog overlay triggered when a user clicks the "Try On" button on any style card (from Gallery or Detail page). It encapsulates the loading process and presents the final interactive Before/After comparison.

#### Layout & Hierarchy
*   **Backdrop Layer:** `#000000` at `40%` opacity with a `12px` backdrop blur (`backdrop-blur-md`).
*   **Modal Container Card:** Centered `rounded-card` with white background, max-width `640px`.
*   **Variant States (Within Modal):**
    *   *State 1: AI Generating (Loading)*
        *   Displays a 3:4 card showing a bare hand contour scan and concentric wave ripple pulses.
        *   Text reading *"AI is polishing your nails..."* and a progress indicator.
    *   *State 2: Success Comparison (Interactive)*
        *   Reveals the bare hand and generated try-on nail split.
        *   An interactive vertical Before/After slider divider. Dragging the handle slides the nail art overlay across the hand model.
        *   *Action Buttons:*
            1.  **Add to Favorites:** Heart icon toggle.
            2.  **Save Image:** Download button to export the combined try-on file.

---

### 2.6 Favorites Page (`/favorites`)

#### Purpose
Allow users to review and manage style selections they have bookmarked.

#### Layout & Hierarchy
*   **Saved Styles Grid:**
    *   A standard 3-column catalog grid displaying the styles saved during the session.
    *   *Empty State Layout:*
        *   An abstract graphic outline of a hand.
        *   Text reading *"Your collection is empty. Start exploring styles to save favorites!"*
        *   A capsule CTA button *"Go to Catalog"* redirecting to `/gallery`.

#### Interactive States
*   *Delete Action:* Hovering on a card displays a small floating trashcan icon. Clicking removes the item from the grid with a fade-out transition.

---

### 2.7 Similar Hand Popup (Modal Overlay)

#### Purpose
A modal dialog showcasing style recommendations matching the user's hand profiling results.

#### Layout & Hierarchy
*   **Background Overlay:** `#000000` fill at `40%` opacity with a `12px` backdrop blur.
*   **Modal Container:**
    *   Centered container card (`rounded-card`) with `#FFFFFF` background.
    *   *Header:* Title *"Matching Styles for Your Hand"* with a high-contrast close button.
    *   *Body Grid:* A 3-column scrollable grid showcasing 6 nail cards. Cards are sorted based on conversion metrics of matching hand profile shapes.
    *   *Action Button:* Capsule button *"Explore All Matches"* redirecting to a filtered `/gallery`.

---

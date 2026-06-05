# Nails-Agent B-End (Merchant/Admin) Page & Interaction Specification

This document details the layout, data metrics components, and interactive specifications for the merchant-facing (B-end) Agent Operations Center.

---

## 1. Screen Inventory (Total: 1 Page)

The B-end application utilizes the `(admin)` routing group with a dark, high-contrast visual identity (**Technical Operations**). To streamline decision auditing and multi-turn querying, the admin dashboard and co-pilot chat are consolidated into a single physical screen router.

*   **Page 1: Admin Dashboard (`/admin`)**: The unified control console containing the Time-travel Timeline sidebar, the central Findings/Decisions drill-down panel, a Candidate Pool carousel, the manual cycle trigger, and an embedded slide-out Co-pilot Chat Drawer.

---

## 2. Page Specifications & Requirements

### 2.1 Admin Dashboard (`/admin`)

#### Purpose
Provide store operators and competition judges a high-contrast dashboard to trigger LangGraph agent runs, review findings, inspect decision evidence, and manage the candidate nail pool, with immediate side-channel access to the AI co-pilot.

#### Layout & Hierarchy
```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [Logo] NailsAgent Admin        [Status: Idle]   [Co-Pilot Toggle] [Run Next Cycle Button]│
├─────────────────┬───────────────────────────────────────┬──────────────────────────────┤
│ Timeline Sidebar│ Central Analytics Workspace           │ Co-Pilot Chat Sidebar        │
│                 │                                       │ (Drawer Panel)               │
│  Run #42 (Act)  │  ┌─────────────────┐ ┌──────────────┐ │                              │
│  • Success      │  │ Selected Run    │ │ Findings     │ │  [Attached: Finding #42]     │
│                 │  └─────────────────┘ └──────────────┘ │                              │
│  Run #41        │  ┌─────────────────┐ ┌──────────────┐ │  User: Why did you demote    │
│  • Success      │  │ Decisions       │ │ Memories     │ │        STYLE_082?            │
│                 │  └─────────────────┘ └──────────────┘ │                              │
│  Run #40        │                                       │  Agent: I detected low heat  │
│  • Completed    │                                       │  conversions and...          │
└─────────────────┴───────────────────────────────────────┴──────────────────────────────┘
```

*   **Global Admin Header (Top):**
    *   Dark slate background (`#09090B`) with thin borders.
    *   *Left:* Semibold logo `NailsAgent Admin` in white.
    *   *Right:* Status indicator (`Status: Running` with pulsing blue ring, or `Status: Idle`), a **Co-Pilot Toggle** button, and the **Run Next Cycle** primary CTA button utilizing a vibrant blue (`#3B82F6`) background.
*   **Time-Travel Timeline (Left Sidebar):**
    *   Width: Fixed `280px`.
    *   Scrollable vertical timeline representing the chronological list of `agent_runs` execution loops.
    *   *Timeline Nodes:*
        *   Contains run ID (e.g. `Run #42`), timestamp (e.g. `12h ago`), and a brief summary of actions taken (e.g., *"Promoted 3 red styles"*).
        *   Status dot: Emerald (`#10B981`) for completed runs, Blue (`#3B82F6`) for running cycles, and Amber (`#F59E0B`) for runs with pending alerts.
*   **Central Drill-Down Workspace (Middle):**
    *   Displays tabs mapping to the selected `agent_runs` ID:
        1.  **Findings Panel:** Lists detected metric anomalies (e.g., *"Lavender cat-eye conversions grew 45%"*). Uses small embedded sparkline charts showing a 7-day traffic trend.
        2.  **Decisions & Evidence Panel:** Displays catalog updates executed by the Agent (e.g. STYLE_032 status transitioned from `candidate` to `listed`). Each row contains a clickable **View Evidence** link, opening a modal detailing the prompt parameters and database query logs used for the action.
        3.  **Strategy Memories:** Renders learned operation rules saved to `strategy_memories` (e.g. *"Lavender cat-eyes have a 92% try-on conversion match on oval hands during warm seasons"*).
*   **Co-Pilot Chat Sidebar (Right Drawer Component):**
    *   Width: Slide-out panel occupying `380px` width when active.
    *   *Message Feed:*
        *   *Agent Message:* Rendered inside `#18181B` (Zinc-900) containers. Code snippets, queries, or JSON schemas are output using `JetBrains Mono` text enclosed in dark borders.
        *   *User Message:* Aligned right, using `#7B5455` (Primary brand color) at `20%` opacity to visually separate conversations.
    *   *Attachment Pill:* Displayed above the input area if a user selects a Finding or Decision from the dashboard and clicks *"Ask Agent"*. The item behaves as a metadata tag (e.g., `[Attached: Finding #48]`).
    *   *Input Box:* A text area aligned to the bottom.
*   **Candidate Pool Carousel (Bottom):**
    *   Horizontal carousel displaying candidate styles (`status = candidate`).
    *   Allows operators to preview Pinterest references and trigger manual promotions if needed.

#### Interactive States
*   *Timeline Node Selection:* Clicking a timeline node updates all data tabs in the Central Workspace with a slide-in fade transition.
*   *Run Next Cycle Click:* Disables the button, updates header status to `Running`, and appends a pulsing blue run node at the top of the Left Timeline.
*   *Co-Pilot Toggle:* Clicking the top header toggle slides the Chat panel in from the right edge with a `duration-300` ease-out transition.
*   *Card Drag-and-Drop:* Finding cards from the dashboard can be dragged directly into the chat drawer console area to automatically attach them to the next prompt message.

---

# Video Pipeline Fixes — Design Spec

> **Date:** 2026-04-09
> **Scope:** OpenMontage remotion-composer improvements
> **Status:** Draft

---

## Problem Statement

The current video generation pipeline has 4 issues:

1. **Text overlap on chart axes** — BarChart x-axis labels and PieChart legend labels overlap when text is long (e.g., "Meeting előkészítés" at fixed 20px fontSize exceeds the ~120px bar width)
2. **No default scene ordering convention** — the compose-director has no enforced pattern for alternating narration, b-roll, and infographic scenes
3. **Audio-video duration mismatch** — narration audio can overrun the total scene plan duration, causing the narration to get cut off at video end
4. **No multi-card scene type** — when narration covers 3-5 key points, there's no way to show them as individual cards animating in sequentially

---

## Fix 1: `<FittedText>` — Global SVG Text Alignment

### Problem

Chart components use raw SVG `<text>` with fixed fontSize and no overflow handling:

- `BarChart.tsx:259-270` — x-axis labels (user-provided text), fontSize=20, no width constraint
- `PieChart.tsx:271-280` — legend labels (user-provided text), fontSize=22

Note: LineChart x-axis labels are numeric (`formatNumber()`) and short — not affected by this issue.

When label text is wider than the available space (bar width, legend column, etc.), labels overlap.

### Solution

A shared `<FittedText>` SVG component with auto-sizing fallback chain.

**Primary approach:** Use SVG `textLength` attribute with `lengthAdjust="spacingAndGlyphs"` — this compresses text into a target width natively in the browser. Since Remotion renders in a real headless Chromium (not SSR), this works accurately.

**Fallback chain** (when `textLength` compression would distort too much, i.e., required width < 50% of natural):

```
1. Reduce fontSize proportionally (min: minFontSize)
2. If still overflows at minFontSize → rotate -45°
3. Last resort → truncate with ellipsis
```

### Interface

```tsx
interface FittedTextProps {
  x: number;
  y: number;
  maxWidth: number;
  fontSize?: number;        // desired size, default 20
  minFontSize?: number;     // floor, default 12
  rotateIfNeeded?: boolean; // default true
  textAnchor?: string;      // default "middle"
  // pass-through SVG text attributes
  fill?: string;
  fontFamily?: string;
  fontWeight?: number;
  opacity?: number;
  children: string;
}
```

### Files

| File | Action |
|------|--------|
| `remotion-composer/src/components/charts/FittedText.tsx` | CREATE |
| `remotion-composer/src/components/charts/BarChart.tsx` | MODIFY — replace label `<text>` at line 259 with `<FittedText maxWidth={barWidth + barGap}>` |
| `remotion-composer/src/components/charts/PieChart.tsx` | MODIFY — replace legend label `<text>` at line 271 with `<FittedText>` |

### Text Width Estimation

For the fallback chain (when `textLength` compression ratio < 50%), we estimate natural text width:

```
averageCharWidth ≈ fontSize × 0.6  (for Inter/sans-serif)
estimatedWidth = text.length × averageCharWidth
```

This heuristic is ~90% accurate for Latin/Hungarian text. Hungarian has wider diacritical characters (ő, ű) but also narrow ones (i, l) — averages out. Good enough for deciding when to switch from `textLength` compression to font-size reduction.

---

## Fix 2: Default Scene Ordering

### Problem

No enforced scene ordering pattern in the compose-director stage. The AI generates arbitrary scene sequences.

### Solution

Update the compose-director skill/prompt to enforce this default structure:

```
1. Opening text (hook/hero_title)
2. Pexels b-roll
3. OpenMontage animated infographic (chart/content_cards)
4. Pexels b-roll
5. OpenMontage animated infographic (chart/content_cards)
6. CTA (closing)
```

This is a **prompt/instruction change**, not a code change. The compose-director skill markdown gets updated with this pattern as the default, with flexibility to adapt based on content.

### Files

| File | Action |
|------|--------|
| `skills/pipelines/explainer/compose-director.md` | MODIFY — add default scene ordering pattern |
| `skills/pipelines/hybrid/compose-director.md` | MODIFY — same pattern (hybrid also uses b-roll + infographics) |

---

## Fix 3: Audio-Video Duration Sync

### Problem

The narration audio duration can exceed the total scene plan duration. When this happens, the narration gets cut off at the end of the video.

### Solution

**Rule: `total_video_duration = audio_duration`**

The scene plan builder must:

1. Calculate total audio duration from the TTS output
2. Distribute scene durations proportionally across the audio timeline
3. If sum of scene durations < audio duration → extend the CTA/closing scene to fill the gap
4. If the gap > 5 seconds → emit a warning (narration may need shortening)

### Implementation

This is enforced in the scene plan generation step, where `in_seconds` / `out_seconds` (or `durationFrames`) are calculated per cut. The Remotion `calculateMetadata()` in Explainer.tsx already derives total video duration from `max(cuts.out_seconds)`, so fixing the scene plan input is sufficient.

### Files

| File | Action |
|------|--------|
| `skills/pipelines/explainer/compose-director.md` | MODIFY — add audio duration sync rule + CTA extension logic |
| `skills/pipelines/hybrid/compose-director.md` | MODIFY — same rule |

Note: Scene plan validation is enforced via the compose-director skill instructions (the agent generates the plan). No separate validation code exists — the agent IS the validator. If a programmatic check is needed later, it would be a new `validate_scene_plan()` function in the compose stage.

---

## Fix 4: `<ContentCards>` — Dynamic Multi-Card Scene

### Problem

When narration covers 3-5 key points, there's no visual scene type that shows them as individual cards. The closest is KPIGrid, but that's designed for numeric metrics, not text-heavy content points.

### Solution

New Remotion scene component: `<ContentCards>`

### Interface

```tsx
interface ContentCard {
  title: string;
  description?: string;
  icon?: string;       // emoji or text glyph
  accent?: string;     // override accent color
}

interface ContentCardsProps {
  cards: ContentCard[];        // 2-5 items
  title?: string;              // optional section title
  layout?: "grid" | "stack";   // grid = 2x2/2x3, stack = vertical list
  fontFamily?: string;
  textColor?: string;
  backgroundColor?: string;
  cardBackgroundColor?: string;
  accentColor?: string;
  colors?: string[];           // per-card accent colors
}
```

### Layout Logic

Auto-layout based on card count:
- 2 cards → side-by-side (1×2)
- 3 cards → top-1, bottom-2 or 1×3 row
- 4 cards → 2×2 grid
- 5 cards → top row 3, bottom row 2 (centered)

Portrait mode: stack vertically regardless of count.

### Animation

- Staggered entrance: each card animates in with ~0.13s delay (4 frames at 30fps)
- Spring-based slide-up + fade-in per card (spring config: damping=14, stiffness=100)
- Order: left-to-right, top-to-bottom
- Fade-out last 0.5s of scene duration

### Card Design

- Rounded rectangle with left accent bar (like KPIGrid cards)
- Icon top, title bold, description smaller below
- Theme-consistent colors from palette
- Responsive sizing based on card count and video dimensions

### Files

| File | Action |
|------|--------|
| `remotion-composer/src/components/ContentCards.tsx` | CREATE |
| `remotion-composer/src/Explainer.tsx` | MODIFY — add `content_cards` to SceneRenderer dispatch + extend `Cut` interface with `cards?: ContentCard[]`, `layout?: 'grid' \| 'stack'`, `cardBackgroundColor?: string` |

---

## Out of Scope

- Replacing Remotion charts with Infographic-original PNG pipeline (deferred)
- New pipeline definitions
- Dual render (16:9 + 9:16) changes
- TTS provider changes

---

## Testing

- FittedText: visual test with long Hungarian labels ("Meeting előkészítés", "Szétszórt kommunikáció")
- ContentCards: test with 2, 3, 4, 5 cards in both landscape and portrait
- Duration sync: test with audio files of known duration vs scene plans
- TypeScript compile: `npx tsc --noEmit` in remotion-composer/

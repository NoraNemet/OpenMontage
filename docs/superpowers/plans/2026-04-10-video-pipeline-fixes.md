# Video Pipeline Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 video pipeline issues: SVG text overlap in charts, default scene ordering, audio-video duration sync, and a new multi-card scene component.

**Architecture:** FittedText is a shared SVG component used by BarChart and PieChart. ContentCards is a new Remotion scene component registered in SceneRenderer. Scene ordering and audio sync are compose-director skill changes (prompt engineering, no code).

**Tech Stack:** React 19, Remotion 4.x, TypeScript, SVG

**Spec:** `docs/superpowers/specs/2026-04-09-video-pipeline-fixes-design.md`

---

## File Map

| File | Status | Responsibility |
|------|--------|---------------|
| `remotion-composer/src/components/charts/FittedText.tsx` | CREATE | Shared SVG text component with auto-sizing |
| `remotion-composer/src/components/charts/BarChart.tsx` | MODIFY | Replace x-axis label `<text>` with `<FittedText>` |
| `remotion-composer/src/components/charts/PieChart.tsx` | MODIFY | Replace legend label `<text>` with `<FittedText>` |
| `remotion-composer/src/components/ContentCards.tsx` | CREATE | Dynamic multi-card scene with staggered animation |
| `remotion-composer/src/Explainer.tsx` | MODIFY | Add `content_cards` dispatch + extend `Cut` interface |
| `skills/pipelines/explainer/compose-director.md` | MODIFY | Default scene ordering + audio duration sync rule |
| `skills/pipelines/hybrid/compose-director.md` | MODIFY | Same scene ordering + audio sync rule |

---

## Task 1: FittedText SVG Component

**Files:**
- Create: `remotion-composer/src/components/charts/FittedText.tsx`

- [ ] **Step 1.1: Create the FittedText component**

```tsx
// remotion-composer/src/components/charts/FittedText.tsx
import React from "react";

interface FittedTextProps {
  x: number;
  y: number;
  maxWidth: number;
  fontSize?: number;
  minFontSize?: number;
  rotateIfNeeded?: boolean;
  textAnchor?: "start" | "middle" | "end";
  fill?: string;
  fontFamily?: string;
  fontWeight?: number;
  opacity?: number;
  dominantBaseline?: string;
  children: string;
}

/**
 * Estimate natural text width for Latin/Hungarian text.
 * ~0.6 × fontSize per character for Inter/sans-serif.
 */
function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.6;
}

/**
 * SVG text element that auto-fits within maxWidth.
 *
 * Strategy:
 * 1. If text fits naturally → render as-is
 * 2. If text is within 50-100% of maxWidth → use SVG textLength compression
 * 3. If compression ratio < 50% → reduce fontSize (down to minFontSize)
 * 4. If still overflows at minFontSize → rotate -45°
 * 5. Last resort → truncate with "…"
 */
export const FittedText: React.FC<FittedTextProps> = ({
  x,
  y,
  maxWidth,
  fontSize = 20,
  minFontSize = 12,
  rotateIfNeeded = true,
  textAnchor = "middle",
  fill,
  fontFamily,
  fontWeight,
  opacity,
  dominantBaseline,
  children,
}) => {
  const text = children;
  const naturalWidth = estimateTextWidth(text, fontSize);

  // Case 1: Fits naturally
  if (naturalWidth <= maxWidth) {
    return (
      <text
        x={x}
        y={y}
        textAnchor={textAnchor}
        fill={fill}
        fontFamily={fontFamily}
        fontWeight={fontWeight}
        fontSize={fontSize}
        opacity={opacity}
        dominantBaseline={dominantBaseline}
      >
        {text}
      </text>
    );
  }

  // Case 2: Use SVG textLength compression (ratio >= 50%)
  const compressionRatio = maxWidth / naturalWidth;
  if (compressionRatio >= 0.5) {
    return (
      <text
        x={x}
        y={y}
        textAnchor={textAnchor}
        fill={fill}
        fontFamily={fontFamily}
        fontWeight={fontWeight}
        fontSize={fontSize}
        opacity={opacity}
        dominantBaseline={dominantBaseline}
        textLength={maxWidth}
        lengthAdjust="spacingAndGlyphs"
      >
        {text}
      </text>
    );
  }

  // Case 3: Reduce fontSize
  const scaledFontSize = Math.max(
    minFontSize,
    Math.floor(fontSize * (maxWidth / naturalWidth))
  );
  const scaledWidth = estimateTextWidth(text, scaledFontSize);

  if (scaledWidth <= maxWidth) {
    return (
      <text
        x={x}
        y={y}
        textAnchor={textAnchor}
        fill={fill}
        fontFamily={fontFamily}
        fontWeight={fontWeight}
        fontSize={scaledFontSize}
        opacity={opacity}
        dominantBaseline={dominantBaseline}
      >
        {text}
      </text>
    );
  }

  // Case 4: Rotate -45° (if enabled)
  if (rotateIfNeeded) {
    return (
      <text
        x={x}
        y={y}
        textAnchor="end"
        fill={fill}
        fontFamily={fontFamily}
        fontWeight={fontWeight}
        fontSize={scaledFontSize}
        opacity={opacity}
        dominantBaseline={dominantBaseline}
        transform={`rotate(-45, ${x}, ${y})`}
      >
        {text}
      </text>
    );
  }

  // Case 5: Truncate with ellipsis
  const avgCharWidth = scaledFontSize * 0.6;
  const maxChars = Math.max(3, Math.floor(maxWidth / avgCharWidth) - 1);
  const truncated = text.length > maxChars ? text.slice(0, maxChars) + "…" : text;

  return (
    <text
      x={x}
      y={y}
      textAnchor={textAnchor}
      fill={fill}
      fontFamily={fontFamily}
      fontWeight={fontWeight}
      fontSize={scaledFontSize}
      opacity={opacity}
      dominantBaseline={dominantBaseline}
    >
      {truncated}
    </text>
  );
};
```

- [ ] **Step 1.2: TypeScript compile check**

```bash
cd /Users/zsoltbaracsy/Coding/OpenMontage/remotion-composer
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 1.3: Commit**

```bash
cd /Users/zsoltbaracsy/Coding/OpenMontage
git add remotion-composer/src/components/charts/FittedText.tsx
git commit -m "feat(charts): FittedText SVG component with auto-sizing fallback chain"
```

---

## Task 2: Wire FittedText into BarChart

**Files:**
- Modify: `remotion-composer/src/components/charts/BarChart.tsx:259-270`

- [ ] **Step 2.1: Add FittedText import to BarChart.tsx**

At top of file, after the existing Remotion imports:

```tsx
import { FittedText } from "./FittedText";
```

- [ ] **Step 2.2: Replace the x-axis label `<text>` element**

Find this block (lines 258-271):

```tsx
              {/* Label */}
              <text
                x={barX + barWidth / 2}
                y={chartBottom + 40}
                textAnchor="middle"
                fill={textColor}
                fontFamily={fontFamily}
                fontWeight={500}
                fontSize={20}
                opacity={barOpacity}
              >
                {datum.label}
              </text>
```

Replace with:

```tsx
              {/* Label */}
              <FittedText
                x={barX + barWidth / 2}
                y={chartBottom + 40}
                maxWidth={barWidth + barGap}
                textAnchor="middle"
                fill={textColor}
                fontFamily={fontFamily}
                fontWeight={500}
                fontSize={20}
                minFontSize={12}
                opacity={barOpacity}
              >
                {datum.label}
              </FittedText>
```

- [ ] **Step 2.3: TypeScript compile check**

```bash
cd /Users/zsoltbaracsy/Coding/OpenMontage/remotion-composer
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 2.4: Visual smoke test — render a BarChart with long Hungarian labels**

Create a test props file:

```bash
cat > /tmp/test-barchart-fitted.json << 'EOF'
{
  "theme": "flowstart",
  "cuts": [
    {
      "id": "test-bar",
      "type": "bar_chart",
      "in_seconds": 0,
      "out_seconds": 5,
      "title": "Heti időpazarlás (óra)",
      "chartData": [
        { "label": "Adatbevitel", "value": 35 },
        { "label": "E-mail kezelés", "value": 28 },
        { "label": "Riportolás", "value": 22 },
        { "label": "Meeting előkészítés", "value": 15 }
      ]
    }
  ],
  "overlays": [],
  "captions": [],
  "audio": {}
}
EOF
```

```bash
cd /Users/zsoltbaracsy/Coding/OpenMontage/remotion-composer
npx remotion render Explainer --props /tmp/test-barchart-fitted.json --output /tmp/test-barchart-fitted.mp4 --frames 0-1
```

Expected: Renders without error. Open `/tmp/test-barchart-fitted.mp4` — labels should NOT overlap. "Meeting előkészítés" should be compressed or font-reduced to fit.

- [ ] **Step 2.5: Commit**

```bash
cd /Users/zsoltbaracsy/Coding/OpenMontage
git add remotion-composer/src/components/charts/BarChart.tsx
git commit -m "fix(charts): BarChart x-axis labels use FittedText to prevent overlap"
```

---

## Task 3: Wire FittedText into PieChart

**Files:**
- Modify: `remotion-composer/src/components/charts/PieChart.tsx:271-280`

- [ ] **Step 3.1: Add FittedText import to PieChart.tsx**

At top of file, after the existing Remotion imports:

```tsx
import { FittedText } from "./charts/FittedText";
```

WAIT — PieChart is already in `components/charts/`, so the import is:

```tsx
import { FittedText } from "./FittedText";
```

- [ ] **Step 3.2: Replace the legend label `<text>` element**

Find this block (lines 271-280):

```tsx
                  <text
                    x={legendX + 32}
                    y={legendY + 6}
                    fill={textColor}
                    fontFamily={fontFamily}
                    fontSize={22}
                    fontWeight={500}
                  >
                    {slice.datum.label}
                  </text>
```

Replace with:

```tsx
                  <FittedText
                    x={legendX + 32}
                    y={legendY + 6}
                    maxWidth={240}
                    textAnchor="start"
                    fill={textColor}
                    fontFamily={fontFamily}
                    fontSize={22}
                    fontWeight={500}
                    minFontSize={14}
                    rotateIfNeeded={false}
                  >
                    {slice.datum.label}
                  </FittedText>
```

Note: `maxWidth={240}` is the available legend text width (from legendX+32 to the percentage text at dx=280). This assumes the default 1920×1080 layout where legendX=1200. For non-standard video sizes, this may need adjustment — but PieChart legend positioning is also hardcoded (legendX=1200), so this is consistent with existing assumptions. `rotateIfNeeded={false}` because rotating legend text would look bad — truncation is the better fallback for legends.

- [ ] **Step 3.3: TypeScript compile check**

```bash
cd /Users/zsoltbaracsy/Coding/OpenMontage/remotion-composer
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3.4: Commit**

```bash
cd /Users/zsoltbaracsy/Coding/OpenMontage
git add remotion-composer/src/components/charts/PieChart.tsx
git commit -m "fix(charts): PieChart legend labels use FittedText to prevent overlap"
```

---

## Task 4: ContentCards Scene Component

**Files:**
- Create: `remotion-composer/src/components/ContentCards.tsx`

- [ ] **Step 4.1: Create the ContentCards component**

```tsx
// remotion-composer/src/components/ContentCards.tsx
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export interface ContentCard {
  title: string;
  description?: string;
  icon?: string;
  accent?: string;
}

interface ContentCardsProps {
  cards: ContentCard[];
  title?: string;
  layout?: "grid" | "stack";
  fontFamily?: string;
  textColor?: string;
  backgroundColor?: string;
  cardBackgroundColor?: string;
  accentColor?: string;
  colors?: string[];
}

/**
 * Calculate grid layout: columns and rows based on card count and orientation.
 */
function computeGrid(
  cardCount: number,
  isPortrait: boolean
): { cols: number; rows: number } {
  if (isPortrait || cardCount <= 1) {
    return { cols: 1, rows: cardCount };
  }
  if (cardCount === 2) return { cols: 2, rows: 1 };
  if (cardCount === 3) return { cols: 3, rows: 1 };
  if (cardCount === 4) return { cols: 2, rows: 2 };
  // 5: top row 3, bottom row 2
  return { cols: 3, rows: 2 };
}

export const ContentCards: React.FC<ContentCardsProps> = ({
  cards,
  title,
  layout,
  fontFamily = "Inter, system-ui, sans-serif",
  textColor = "#1F2937",
  backgroundColor = "#FFFFFF",
  cardBackgroundColor = "#F9FAFB",
  accentColor = "#2563EB",
  colors = ["#2563EB", "#F59E0B", "#10B981", "#EC4899", "#06B6D4"],
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width: videoWidth, height: videoHeight } = useVideoConfig();
  const isPortrait = videoHeight > videoWidth;

  // Guard: empty cards array
  if (cards.length === 0) {
    return <AbsoluteFill style={{ background: backgroundColor }} />;
  }

  const effectiveLayout = layout ?? (isPortrait ? "stack" : "grid");

  const padding = isPortrait ? 50 : 80;
  const cardGap = isPortrait ? 20 : 24;
  const titleHeight = title ? (isPortrait ? 100 : 120) : 0;
  const gridTop = (isPortrait ? 50 : 60) + titleHeight;
  const gridWidth = videoWidth - padding * 2;
  const gridHeight = videoHeight - gridTop - (isPortrait ? 50 : 60);

  const { cols, rows } = effectiveLayout === "stack"
    ? { cols: 1, rows: cards.length }
    : computeGrid(cards.length, isPortrait);

  const cardWidth = (gridWidth - cardGap * (cols - 1)) / cols;
  const cardHeight = Math.min(
    (gridHeight - cardGap * (rows - 1)) / rows,
    isPortrait ? 260 : 300
  );

  // Center grid vertically
  const totalGridHeight = rows * cardHeight + (rows - 1) * cardGap;
  const gridTopOffset = gridTop + (gridHeight - totalGridHeight) / 2;

  // Fade out last 0.5s
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        background: backgroundColor,
        fontFamily,
      }}
    >
      {/* Title */}
      {title && (
        <div
          style={{
            position: "absolute",
            top: isPortrait ? 50 : 60,
            left: 0,
            right: 0,
            textAlign: "center",
            fontSize: isPortrait ? 40 : 48,
            fontWeight: 700,
            color: textColor,
            fontFamily,
            opacity:
              spring({ frame, fps, config: { damping: 20 } }) * fadeOut,
          }}
        >
          {title}
        </div>
      )}

      {/* Cards */}
      {cards.map((card, idx) => {
        const accent = card.accent || colors[idx % colors.length];
        const staggerDelay = idx * 4; // ~0.13s per card at 30fps

        // Spring-based slide-up + fade-in entrance
        const entrance = spring({
          frame: frame - staggerDelay,
          fps,
          config: { damping: 14, stiffness: 100 },
        });
        const slideY = interpolate(entrance, [0, 1], [40, 0]);
        const cardOpacity = entrance;

        // Position calculation
        let left: number;
        let top: number;

        if (effectiveLayout === "stack") {
          left = padding;
          top = gridTopOffset + idx * (cardHeight + cardGap);
        } else {
          const row = Math.floor(idx / cols);
          const colInRow = idx % cols;
          const itemsInRow = row === rows - 1
            ? cards.length - cols * (rows - 1)
            : cols;
          // Center rows with fewer items
          const rowWidth = itemsInRow * cardWidth + (itemsInRow - 1) * cardGap;
          const rowLeft = padding + (gridWidth - rowWidth) / 2;
          left = rowLeft + colInRow * (cardWidth + cardGap);
          top = gridTopOffset + row * (cardHeight + cardGap);
        }

        return (
          <div
            key={card.title}
            style={{
              position: "absolute",
              left,
              top,
              width: effectiveLayout === "stack" ? gridWidth : cardWidth,
              height: cardHeight,
              backgroundColor: cardBackgroundColor,
              borderRadius: 12,
              borderLeft: `4px solid ${accent}`,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: effectiveLayout === "stack" ? "flex-start" : "center",
              padding: effectiveLayout === "stack" ? "24px 32px" : 24,
              opacity: cardOpacity * fadeOut,
              transform: `translateY(${slideY}px)`,
              boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            }}
          >
            {/* Icon */}
            {card.icon && (
              <div style={{ fontSize: 32, marginBottom: 8 }}>
                {card.icon}
              </div>
            )}

            {/* Title */}
            <div
              style={{
                fontSize: effectiveLayout === "stack" ? 28 : 24,
                fontWeight: 700,
                color: textColor,
                fontFamily,
                lineHeight: 1.2,
                textAlign: effectiveLayout === "stack" ? "left" : "center",
              }}
            >
              {card.title}
            </div>

            {/* Description */}
            {card.description && (
              <div
                style={{
                  fontSize: effectiveLayout === "stack" ? 20 : 17,
                  fontWeight: 400,
                  color: textColor,
                  fontFamily,
                  marginTop: 8,
                  opacity: 0.7,
                  lineHeight: 1.4,
                  textAlign: effectiveLayout === "stack" ? "left" : "center",
                }}
              >
                {card.description}
              </div>
            )}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
```

- [ ] **Step 4.2: TypeScript compile check**

```bash
cd /Users/zsoltbaracsy/Coding/OpenMontage/remotion-composer
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4.3: Commit**

```bash
cd /Users/zsoltbaracsy/Coding/OpenMontage
git add remotion-composer/src/components/ContentCards.tsx
git commit -m "feat(remotion): ContentCards scene component with staggered grid animation"
```

---

## Task 5: Wire ContentCards into Explainer.tsx

**Files:**
- Modify: `remotion-composer/src/Explainer.tsx`

- [ ] **Step 5.1: Add import**

After the existing `InfographicScene` import (line 45), add:

```tsx
import { ContentCards, type ContentCard } from "./components/ContentCards";
```

- [ ] **Step 5.2: Make `source` optional and extend the Cut interface**

In the `Cut` interface (line 188-263):

First, change `source` from required to optional (line 190):
```tsx
// Change:  source: string;
// To:      source?: string;
```

This is required because component-only cuts (text_card, bar_chart, content_cards, etc.) don't have a media source file. The SceneRenderer already handles `!cut.source` at line 682.

Then, before the closing `}`, add these fields:

```tsx
  // ContentCards props (type: "content_cards")
  cards?: ContentCard[];
  layout?: "grid" | "stack";
  cardBackgroundColor?: string;
```

- [ ] **Step 5.3: Add content_cards dispatch to SceneRenderer**

In the `SceneRenderer` function, after the infographic scene block (line 663, before the `// --- Media types ---` comment), add:

```tsx
  // --- Content cards scene ---
  if (cut.type === "content_cards" && cut.cards && cut.cards.length > 0) {
    return maybeWrapWithBgImage(
      <ContentCards
        cards={cut.cards}
        title={cut.title}
        layout={cut.layout}
        fontFamily={theme.bodyFont + ", system-ui, sans-serif"}
        textColor={textColor}
        backgroundColor={bgColor}
        cardBackgroundColor={cut.cardBackgroundColor || theme.surfaceColor}
        accentColor={accent}
        colors={cut.chartColors || theme.chartColors}
      />
    );
  }
```

- [ ] **Step 5.4: TypeScript compile check**

```bash
cd /Users/zsoltbaracsy/Coding/OpenMontage/remotion-composer
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5.5: Visual smoke test — render ContentCards with 4 items**

```bash
cat > /tmp/test-content-cards.json << 'EOF'
{
  "theme": "flowstart",
  "cuts": [
    {
      "id": "test-cards",
      "type": "content_cards",
      "in_seconds": 0,
      "out_seconds": 5,
      "title": "5 jel, hogy ideje automatizálni",
      "cards": [
        { "title": "Manuális adatbevitel", "description": "Napi 2+ óra copy-paste", "icon": "📋" },
        { "title": "E-mail túlterhelés", "description": "100+ email naponta", "icon": "📧" },
        { "title": "Szétszórt kommunikáció", "description": "3+ platform egyszerre", "icon": "💬" },
        { "title": "Ismétlődő riportok", "description": "Heti manuális összesítés", "icon": "📊" },
        { "title": "Lassú ügyfél válasz", "description": "48+ óra válaszidő", "icon": "⏱️" }
      ]
    }
  ],
  "overlays": [],
  "captions": [],
  "audio": {}
}
EOF
```

```bash
cd /Users/zsoltbaracsy/Coding/OpenMontage/remotion-composer
npx remotion render Explainer --props /tmp/test-content-cards.json --output /tmp/test-content-cards.mp4 --frames 0-30
```

Expected: Renders without error. Open the video — 4 cards in a 2×2 grid, staggered entrance animation, Flowstart brand colors.

- [ ] **Step 5.6: Commit**

```bash
cd /Users/zsoltbaracsy/Coding/OpenMontage
git add remotion-composer/src/Explainer.tsx
git commit -m "feat(remotion): wire ContentCards into SceneRenderer + extend Cut interface"
```

---

## Task 6: Compose-Director Skill Updates (Scene Ordering + Audio Sync)

**Files:**
- Modify: `skills/pipelines/explainer/compose-director.md`
- Modify: `skills/pipelines/hybrid/compose-director.md`

- [ ] **Step 6.1: Read the current explainer compose-director**

```bash
cat /Users/zsoltbaracsy/Coding/OpenMontage/skills/pipelines/explainer/compose-director.md
```

Identify where to add the scene ordering rule and audio sync rule.

- [ ] **Step 6.2: Add default scene ordering section to explainer compose-director**

After the "Step 1: Choose Render Strategy" section and before "Step 2: Audio Acquisition", add a new section:

```markdown
### Step 1b: Default Scene Ordering

When building the scene plan (edit_decisions cuts array), follow this default visual rhythm unless the content explicitly requires a different structure:

```
1. Opening text — hook/hero_title (grab attention, state the problem)
2. Pexels b-roll — relevant stock footage supporting the hook
3. Animated infographic — bar_chart / pie_chart / kpi_grid / content_cards (data/evidence)
4. Pexels b-roll — transition footage
5. Animated infographic — content_cards / bar_chart / kpi_grid (solution/results)
6. CTA — text_card with isCta=true (call to action, closing)
```

**Rules:**
- Never put two infographic scenes back-to-back — always separate with b-roll or text
- B-roll should visually relate to the narration topic at that point
- Use `content_cards` (type: "content_cards") when the narration covers 3-5 key points that deserve individual cards
- Use chart types (bar_chart, pie_chart, kpi_grid) for quantitative data
- The CTA scene is always last
```

- [ ] **Step 6.3: Add audio duration sync rule to explainer compose-director**

In the "Step 2: Audio Acquisition" section, find these two comment lines inside the TTS Python code block (lines 83-84):

```python
   # CRITICAL: Check result.data['audio_duration_seconds'] vs video duration
   # If narration exceeds video by >1s: shorten script and regenerate
```

**Replace those 2 lines** with the following expanded guidance:

```markdown
   # CRITICAL: Audio-video duration sync
   # Rule: total_video_duration = audio_duration
   audio_duration = result.data['audio_duration_seconds']

   # Adjust scene plan to match audio duration:
   # 1. Calculate total scene duration from cuts
   # 2. If audio_duration > total_scene_duration:
   #    → Extend the CTA/closing scene to fill the gap
   #    → If gap > 5s: WARNING — narration is too long, consider shortening
   # 3. If audio_duration < total_scene_duration:
   #    → Proportionally shrink non-CTA scenes to match
   # 4. Update all cut in_seconds/out_seconds to reflect new durations
   # The Remotion calculateMetadata() derives video length from max(cuts.out_seconds),
   # so the scene plan timings ARE the video duration.
```

- [ ] **Step 6.4: Add same rules to hybrid compose-director**

Add the same two sections (scene ordering + audio sync) to `skills/pipelines/hybrid/compose-director.md`. Insert after the "2. Check Variant Integrity" section:

```markdown
### 2b. Default Scene Ordering

Follow the same scene ordering rhythm as the explainer pipeline:

```
1. Opening text (hook/hero_title)
2. Source media or b-roll
3. Animated infographic (chart/content_cards)
4. Source media or b-roll
5. Animated infographic (chart/content_cards)
6. CTA (closing)
```

Adapt for hybrid context: source media replaces pure b-roll where the brief includes original footage.

### 2c. Audio-Video Duration Sync

**Rule: `total_video_duration = audio_duration`**

When narration audio is present, the scene plan timings must match the audio duration exactly. If audio overruns the scene plan, extend the CTA/closing scene. If the gap exceeds 5 seconds, the narration script should be shortened.
```

- [ ] **Step 6.5: Commit**

```bash
cd /Users/zsoltbaracsy/Coding/OpenMontage
git add skills/pipelines/explainer/compose-director.md skills/pipelines/hybrid/compose-director.md
git commit -m "feat(skills): default scene ordering + audio-video duration sync rules"
```

---

## Task 7: Integration Smoke Test

- [ ] **Step 7.1: Full TypeScript compile**

```bash
cd /Users/zsoltbaracsy/Coding/OpenMontage/remotion-composer
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 7.2: List available compositions**

```bash
cd /Users/zsoltbaracsy/Coding/OpenMontage/remotion-composer
npx remotion compositions
```

Expected: `Explainer` (and others) listed.

- [ ] **Step 7.3: Render a full integration test video**

Create a scene plan that exercises all fixes:

```bash
cat > /tmp/test-full-pipeline.json << 'EOF'
{
  "theme": "flowstart",
  "cuts": [
    {
      "id": "hook",
      "type": "hero_title",
      "in_seconds": 0,
      "out_seconds": 3,
      "text": "Csapata hetente 10+ órát veszít el."
    },
    {
      "id": "bar",
      "type": "bar_chart",
      "in_seconds": 3,
      "out_seconds": 8,
      "title": "Heti időpazarlás (óra)",
      "chartData": [
        { "label": "Adatbevitel", "value": 35 },
        { "label": "E-mail kezelés", "value": 28 },
        { "label": "Riportolás", "value": 22 },
        { "label": "Meeting előkészítés", "value": 15 }
      ]
    },
    {
      "id": "cards",
      "type": "content_cards",
      "in_seconds": 8,
      "out_seconds": 14,
      "title": "5 jel, hogy ideje automatizálni",
      "cards": [
        { "title": "Manuális adatbevitel", "icon": "📋" },
        { "title": "E-mail túlterhelés", "icon": "📧" },
        { "title": "Szétszórt kommunikáció", "icon": "💬" },
        { "title": "Ismétlődő riportok", "icon": "📊" },
        { "title": "Lassú ügyfél válasz", "icon": "⏱️" }
      ]
    },
    {
      "id": "pie",
      "type": "pie_chart",
      "in_seconds": 14,
      "out_seconds": 19,
      "title": "Automatizálható tevékenységek",
      "chartData": [
        { "label": "Adatbevitel és másolás", "value": 35 },
        { "label": "E-mail feldolgozás", "value": 28 },
        { "label": "Riportolás és összesítés", "value": 22 },
        { "label": "Meeting előkészítés", "value": 15 }
      ]
    },
    {
      "id": "cta",
      "type": "text_card",
      "in_seconds": 19,
      "out_seconds": 24,
      "text": "flowstart.eu\nIngyenes stratégiai hívás",
      "isCta": true
    }
  ],
  "overlays": [],
  "captions": [],
  "audio": {}
}
EOF
```

```bash
cd /Users/zsoltbaracsy/Coding/OpenMontage/remotion-composer
npx remotion render Explainer --props /tmp/test-full-pipeline.json --output /tmp/test-full-pipeline.mp4
```

Expected: 24-second video renders. Check:
- BarChart labels don't overlap (FittedText working)
- ContentCards shows 5 cards in 3+2 layout with stagger
- PieChart legend labels don't overlap (FittedText working)
- CTA card at the end

- [ ] **Step 7.4: Commit (if any fixes needed)**

Only if previous steps required adjustments.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `npx tsc` fails with FittedText import | Check the import path — BarChart and PieChart are in `charts/`, so import is `./FittedText` |
| ContentCards doesn't render | Verify `cut.type === "content_cards"` matches exactly (underscore, not hyphen) |
| Remotion render fails | Run `npx remotion compositions` first to verify composition is registered |
| Bar labels still overlap | Check that `maxWidth={barWidth + barGap}` is passed — log `barWidth` and `barGap` values |
| Cards layout wrong in portrait | Verify `isPortrait` detection: `videoHeight > videoWidth` |

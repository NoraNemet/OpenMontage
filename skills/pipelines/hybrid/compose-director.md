# Compose Director - Hybrid Pipeline

## When To Use

Render the hybrid project so source media, support graphics, and audio all remain coherent across outputs.

## Prerequisites

| Layer | Resource | Purpose |
|-------|----------|---------|
| Schema | `schemas/artifacts/render_report.schema.json` | Artifact validation |
| Prior artifacts | `state.artifacts["edit"]["edit_decisions"]`, `state.artifacts["assets"]["asset_manifest"]` | Edit logic and support assets |
| Tools | `video_compose`, `audio_mixer`, `video_stitch`, `video_trimmer`, `color_grade`, `audio_enhance` | Final assembly and polish |
| Playbook | Active style playbook | Output consistency |

## Process

### 1. Verify Source And Support Balance

The final render should still look like a source-led video with support, not a collage of unrelated systems.

### 2. Check Variant Integrity

For each output variant, verify:

- crop safety,
- text safety,
- subtitle legibility,
- audio consistency.

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

### 2d. Text Overflow & Alignment Rules

**CRITICAL: All user-facing text must fit its container.** These rules apply to every scene type.

- **SVG:** Use `<FittedText>` (not raw `<text>`) with explicit `maxWidth` for all labels
- **HTML:** Use `overflow: hidden` + `textOverflow: ellipsis` on all text containers
- **Legends/axes:** Label maxWidth = available space - value width - gaps. Never let labels overlap values.
- **CTA scenes:** Use `text` for headline, `subtitle` for CTA description. Do NOT combine with `\n`.
- **Assume long text** — Hungarian/German labels are 2-3× English length. Test with ~35 char labels.

### 3. Keep Audio Coherent

Source dialogue, narration, music, and effects should feel like one mix, not separate layers fighting for space.

### 4. Use Render Metadata

Recommended metadata keys:

- `variant_outputs`
- `balance_checks`
- `subtitle_checks`
- `audio_notes`

## Common Pitfalls

- Good master cut, broken platform variants.
- Support graphics clipping in vertical exports.
- Audio loudness shifting between source and generated sections.

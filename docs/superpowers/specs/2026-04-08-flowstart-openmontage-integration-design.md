# Design: Flowstart OpenMontage Integration

**Date:** 2026-04-08
**Project:** OpenMontage @ `/Users/zsoltbaracsy/Coding/OpenMontage`
**Goal:** Multi-provider pipeline bővítés — Kie.ai TTS + Infographic-original + Flowstart brand playbook + dual render (16:9 + 9:16)

---

## 1. Scope

### In scope
- `tools/_kie_client.py` — shared Kie.ai polling utility minden jövőbeli Kie.ai tool-hoz
- `tools/audio/kie_tts.py` — ElevenLabs TTS turbo 2.5 via Kie.ai API, natív BaseTool
- `tools/graphics/_infographic_renderer.js` — Node.js script: DSL string → SVG → PNG (sharp)
- `tools/graphics/infographic_png.py` — Infographic-original BaseTool wrapper (subprocess)
- `styles/flowstart.yaml` — Flowstart brand playbook (#4F46E5, #6b00b8, Plus Jakarta Sans)
- `remotion-composer/src/InfographicScene.tsx` — animált infografika Remotion scene type
- `remotion-composer/src/Root.tsx` — "flowstart" theme + InfographicScene + `Explainer9x16` composition hozzáadása
- `pipeline_defs/flowstart-ad.yaml` — dedikált Flowstart reklám pipeline
- `scripts/reflow-for-reels.py` — 16:9 scene plan → 9:16 Reels scene plan konverzió
- `scripts/render-dual.sh` — 16:9 + 9:16 dual render script

### Out of scope
- Kie.ai image/video generátor tool
- Kie.ai MiniMax/Kling/Veo wrapper-ek
- Infographic-original teljes React komponens library Remotionba importálása

---

## 2. Architektúra

### 2.1 Kie.ai shared client (`tools/_kie_client.py`)

```python
class KieAiClient:
    base_url = "https://api.kie.ai"
    # auth: Bearer token from KIE_API_KEY env var

    def create_task(self, model: str, input_params: dict) -> str:
        # POST /api/v1/jobs/createTask
        # Returns taskId string

    def poll_task(self, task_id: str, timeout=120, interval=2) -> list[str]:
        # GET /api/v1/jobs/recordInfo?taskId=...
        # Polls until state in ["success", "fail"]
        # On success: response.data.resultJson is a JSON *string* — must json.loads() it first
        # Then extract resultUrls[] from the parsed object
        # Returns list of URL strings
        # Raises TimeoutError or RuntimeError on failure
```

### 2.2 Kie.ai TTS Tool (`tools/audio/kie_tts.py`)

```python
class KieTts(BaseTool):
    name = "kie_tts"
    provider = "kie_ai"
    capability = "tts"
    runtime = ToolRuntime.API
    tier = ToolTier.VOICE          # egyezik piper_tts, openai_tts konvencióval
    fallback = "piper_tts"
    fallback_tools = ["piper_tts"]
    dependencies = ["env:KIE_API_KEY"]

    def execute(self, inputs: dict) -> ToolResult:
        # inputs keys: "text" (required), "voice" (default "Rachel"), "speed" (default 1.0), "language_code" (optional)
        # 1. KieAiClient.create_task(model="elevenlabs/text-to-speech-turbo-2-5", input={text, voice, speed})
        # 2. KieAiClient.poll_task(taskId) → mp3_url
        # 3. urllib.request.urlretrieve(mp3_url, local_path)
        # Returns ToolResult with output: {"audio_path": "/tmp/kie_tts_<hash>.mp3", "duration_seconds": float}
```

**Cost estimate:** ~$0.003/1000 chars
**Fallback:** piper_tts (local, ingyenes) ha KIE_API_KEY hiányzik

### 2.3 Infographic PNG Tool (`tools/graphics/infographic_png.py` + `_infographic_renderer.js`)

Az `@antv/infographic` SSR API **DSL szöveg stringet** vár, nem JSON dict-et:

```js
// tools/graphics/_infographic_renderer.js
import { renderToString } from '@antv/infographic/ssr';
import sharp from 'sharp';

const syntax = process.argv[2];          // DSL string stdin-ről vagy arg-ból
const outputPath = process.argv[3];
const width = parseInt(process.argv[4]) || 1920;
const height = parseInt(process.argv[5]) || 1080;

const svgString = await renderToString(syntax);
await sharp(Buffer.from(svgString))
  .resize(width, height, { fit: 'contain', background: '#ffffff' })
  .png()
  .toFile(outputPath);
```

**npm deps** (remotion-composer-tól különálló, vagy `tools/graphics/package.json`):
- `@antv/infographic` (linked from `~/Coding/Infographic-original`)
- `sharp` (^0.33)

```python
class InfographicPng(BaseTool):
    name = "infographic_png"
    provider = "infographic_original"
    capability = "infographic"
    runtime = ToolRuntime.LOCAL
    tier = ToolTier.GENERATE
    dependencies = ["cmd:node", "cmd:npx", "python:subprocess"]

    def execute(self, inputs: dict) -> ToolResult:
        # inputs keys: "syntax" (required, @antv/infographic DSL string), "width" (default 1920), "height" (default 1080)
        # syntax example: "infographic list-row-simple-horizontal-arrow\ndata\n  lists\n    - label Step 1"
        # Subprocess: node tools/graphics/_infographic_renderer.js "<syntax>" <output.png> <w> <h>
        # Returns ToolResult with output: {"image_path": "/tmp/infographic_<hash>.png"}
```

**DSL generálás:** A pipeline agent a scene spec-ből DSL stringet ír (vagy előre elkészített DSL template-eket használ a `tools/graphics/infographic_templates/` mappából).

### 2.4 Flowstart Style Playbook (`styles/flowstart.yaml`)

```yaml
name: flowstart
version: "1.0"
mood: professional, trustworthy, modern
colors:
  primary: "#4F46E5"
  secondary: "#6b00b8"
  background: "#ffffff"
  surface: "#f8f9ff"
  text_primary: "#1e293b"
  text_secondary: "#64748b"
  accent: "#a5b4fc"
typography:
  heading: "Plus Jakarta Sans"
  body: "Inter"
  weights: [400, 600, 700, 800]
motion:
  entrance: "fade-slide-up"
  exit: "fade"
  easing: "cubic-bezier(0.16, 1, 0.3, 1)"
```

### 2.5 InfographicScene Remotion Component (`remotion-composer/src/InfographicScene.tsx`)

```tsx
interface InfographicSceneProps {
  imageUrl: string           // renderelt PNG elérési útja
  animationStyle: "fade-in" | "slide-up" | "zoom-in"
  durationInFrames: number
  overlayText?: string
}
// Renders: <Img src={imageUrl}> spring-animált entrance-szel
// Nem importálja az @antv/infographic React lib-et — csak a kész PNG-t animálja
```

### 2.6 Root.tsx módosítások

Két új regisztrálás:
1. `InfographicScene` hozzáadása az elérhető scene type-ok közé
2. Új `Explainer9x16` composition:

```tsx
<Composition
  id="Explainer9x16"
  component={Explainer}
  width={1080}
  height={1920}
  fps={30}
  calculateMetadata={explainerCalculateMetadata}  // ugyanaz a calculateMetadata mint az Explainer 16:9-nél
/>
// Előfeltétel (implementációs sorrend 7a. lépés, lásd alább):
// Az Explainer komponens kap egy opcionális `layout: "horizontal" | "vertical"` prop-ot.
// Ha `layout="vertical"` (9:16 esetén), a cuts egymás alatt stackelődnek (flexDirection: 'column').
// ExplainerProps kiegészítése: layout?: "horizontal" | "vertical" (default: "horizontal")
```

A 9:16 layout `flexDirection: 'column'` stack-et használ a 16:9 side-by-side helyett.

### 2.7 Reels Scene Plan Konverzió (`scripts/reflow-for-reels.py`)

**Input:** `scene-plan-linkedin.json` (16:9 scene plan)
**Output:** `scene-plan-reels.json` (9:16 Reels scene plan)

**Transzformációk:**
- `fontSize` értékek ×1.4 (kisebb szélesség kompenzálás)
- Pexels B-roll clip-ek: crop `center` portrait módba (1080×1920 center crop)
- KPIGrid: `layout: "vertical-stack"` (4 kártya egymás alatt 16:9 helyett 2×2)
- HeroTitle: sorköz növelés a nagyobb szöveg mérethez
- Padding/margin értékek arányos skálázás

### 2.8 Dual Render (`scripts/render-dual.sh`)

```bash
#!/bin/bash
SCENE_PLAN=$1
OUTPUT_DIR=$2

# Generate Reels scene plan
python3 scripts/reflow-for-reels.py "$SCENE_PLAN" "${SCENE_PLAN%.json}-reels.json"

# 16:9 LinkedIn render
npx remotion render Explainer \
  --props "$SCENE_PLAN" \
  --output "$OUTPUT_DIR/flowstart-linkedin.mp4"

# 9:16 Reels render
npx remotion render Explainer9x16 \
  --props "${SCENE_PLAN%.json}-reels.json" \
  --output "$OUTPUT_DIR/flowstart-reels.mp4"
```

### 2.9 Flowstart Ad Pipeline (`pipeline_defs/flowstart-ad.yaml`)

```yaml
name: flowstart-ad
description: "Flowstart brand reklám — LinkedIn 16:9 + Instagram Reels 9:16"
style: flowstart
stages: [script, tts, broll, infographic, compose, dual_render]
tools_preferred:
  tts: kie_tts
  broll: pexels_video
  infographic: infographic_png
```

---

## 3. Scene Plan (konkrét Flowstart videó)

| # | Típus | Tartalom | Hossz |
|---|-------|----------|-------|
| 1 | HeroTitle | "Csapata hetente 10+ órát veszít el." | 3s |
| 2 | Pexels B-roll | iroda, copy-paste, spreadsheet | 3.5s |
| 3 | InfographicScene (PNG) | 5 Signs összefoglaló infografika | 5s |
| 4 | Pexels B-roll | ügyfélszolgálat / meeting | 3.5s |
| 5 | InfographicScene (animált) | bar chart — időpazarlás per tevékenység | 5s |
| 6 | KPIGrid | 80%↓ · 24/7 AI · 2–4 hét · 10× tartalom | 5s |
| 7 | Pexels B-roll | sikeres csapat / laptop | 3.5s |
| 8 | CTA | flowstart.eu — Ingyenes stratégiai hívás | 5s |

**Total: ~34 másodperc** · Narráció: Kie.ai ElevenLabs TTS turbo 2.5

---

## 4. Extensibility

Új Kie.ai provider hozzáadása:
1. Hozz létre `tools/<category>/kie_<name>.py`
2. Örökölj `BaseTool`-tól, importáld `KieAiClient`-et `tools._kie_client`-ből
3. `provider="kie_ai"`, `capability="<type>"`, `dependencies=["env:KIE_API_KEY"]`
4. Implementáld `execute()` — registry auto-discovery felveszi

---

## 5. Environment

```env
# OpenMontage .env — értékeket másold át a Jarvis .env-ből
KIE_API_KEY=<copy from Jarvis .env>
PEXELS_API_KEY=<copy from Jarvis .env>
OPENAI_API_KEY=<existing>
```

---

## 6. Output

```
~/.claude-relay/content/2026-04-08-linkedin-video/
  flowstart-linkedin.mp4     # 1920×1080, 16:9, LinkedIn feed
  flowstart-reels.mp4        # 1080×1920, 9:16, Instagram Reels
```

---

## 7. Implementation Order

1. `tools/_kie_client.py` — shared Kie.ai polling utility
2. `tools/audio/kie_tts.py` — TTS tool (ToolTier.VOICE)
3. `styles/flowstart.yaml` — brand playbook
4. `tools/graphics/_infographic_renderer.js` — Node.js SVG→PNG (sharp dep)
5. `tools/graphics/infographic_png.py` — BaseTool wrapper
6. `remotion-composer/src/InfographicScene.tsx` — animált PNG scene
7. `remotion-composer/src/Root.tsx` — InfographicScene + Explainer9x16 hozzáadása
7a. `remotion-composer/src/Explainer.tsx` — `layout?: "horizontal" | "vertical"` prop hozzáadása; `layout="vertical"` esetén `flexDirection: 'column'` stack
8. `scripts/reflow-for-reels.py` — 16:9→9:16 scene plan konverter
9. `pipeline_defs/flowstart-ad.yaml` + `scripts/render-dual.sh`
10. Flowstart videó generálása az új pipeline-nal

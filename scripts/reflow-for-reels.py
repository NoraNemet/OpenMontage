#!/usr/bin/env python3
# scripts/reflow-for-reels.py
"""Convert a 16:9 scene plan JSON to a 9:16 Reels scene plan."""
import copy
import json
import sys
from pathlib import Path

FONT_SCALE = 1.4


def transform_scene(scene: dict) -> dict:
    """Apply 9:16 transformations to a single scene dict."""
    s = copy.deepcopy(scene)

    # Scale font sizes
    if "fontSize" in s:
        s["fontSize"] = round(s["fontSize"] * FONT_SCALE, 1)

    # KPIGrid: any layout → vertical stack
    if s.get("type") in ("kpi_grid", "KPIGrid"):
        s["layout"] = "vertical-stack"

    # Pexels B-roll: center portrait crop
    if s.get("type") in ("pexels_broll", "pexels_video", "broll"):
        s["crop"] = "center"
        s["cropWidth"] = 1080
        s["cropHeight"] = 1920

    # HeroTitle: increase line height for larger text
    if s.get("type") in ("hero_title", "HeroTitle"):
        s["lineHeight"] = round(s.get("lineHeight", 1.2) * 1.1, 2)

    # Scale padding/margin proportionally
    for key in ("padding", "margin", "paddingX", "paddingY"):
        if key in s and isinstance(s[key], (int, float)):
            s[key] = round(s[key] * 0.8, 1)

    return s


def convert_plan(plan: dict) -> dict:
    """Convert full scene plan from 16:9 to 9:16."""
    result = copy.deepcopy(plan)
    result["width"] = 1080
    result["height"] = 1920
    result["layout"] = "vertical"
    result["scenes"] = [transform_scene(s) for s in plan.get("scenes", [])]
    return result


def main():
    if len(sys.argv) < 3:
        print("Usage: reflow-for-reels.py <input.json> <output.json>")
        sys.exit(1)

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])

    plan = json.loads(input_path.read_text())
    reels_plan = convert_plan(plan)
    output_path.write_text(json.dumps(reels_plan, indent=2, ensure_ascii=False))
    print(f"Reels plan saved → {output_path}")


if __name__ == "__main__":
    main()

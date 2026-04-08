import pytest
import json, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def _load_converter():
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "reflow",
        os.path.join(os.path.dirname(__file__), "../scripts/reflow-for-reels.py")
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class TestReflowForReels:
    def test_font_sizes_scaled_up(self):
        mod = _load_converter()
        scene = {"type": "hero_title", "fontSize": 100}
        result = mod.transform_scene(scene)
        assert result["fontSize"] == pytest.approx(140.0)

    def test_kpigrid_gets_vertical_layout(self):
        mod = _load_converter()
        scene = {"type": "kpi_grid", "layout": "2x2"}
        result = mod.transform_scene(scene)
        assert result["layout"] == "vertical-stack"

    def test_pexels_broll_gets_portrait_crop(self):
        mod = _load_converter()
        scene = {"type": "pexels_broll", "crop": "landscape"}
        result = mod.transform_scene(scene)
        assert result["crop"] == "center"
        assert result.get("cropWidth") == 1080
        assert result.get("cropHeight") == 1920

    def test_convert_plan_transforms_all_scenes(self):
        mod = _load_converter()
        plan = {
            "scenes": [
                {"type": "hero_title", "fontSize": 80},
                {"type": "kpi_grid"},
                {"type": "pexels_broll"},
            ]
        }
        result = mod.convert_plan(plan)
        assert result["scenes"][0]["fontSize"] == pytest.approx(112.0)
        assert result["scenes"][1]["layout"] == "vertical-stack"
        assert result["scenes"][2]["crop"] == "center"

    def test_output_has_reels_dimensions(self):
        mod = _load_converter()
        plan = {"scenes": []}
        result = mod.convert_plan(plan)
        assert result.get("width") == 1080
        assert result.get("height") == 1920

    def test_original_plan_not_mutated(self):
        mod = _load_converter()
        plan = {"scenes": [{"type": "hero_title", "fontSize": 80}]}
        mod.convert_plan(plan)
        assert plan["scenes"][0]["fontSize"] == 80  # unchanged

    def test_scenes_without_fontsize_unaffected(self):
        mod = _load_converter()
        scene = {"type": "pexels_broll"}
        result = mod.transform_scene(scene)
        assert "fontSize" not in result

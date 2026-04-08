import pytest
from unittest.mock import patch, MagicMock
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


class TestInfographicPngExecute:
    def _make_tool(self):
        from tools.graphics.infographic_png import InfographicPng
        return InfographicPng()

    def test_returns_image_path_on_success(self, tmp_path):
        tool = self._make_tool()
        fake_png = tmp_path / "out.png"
        fake_png.write_bytes(b"\x89PNG" + b"\x00" * 100)

        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = f"OK: {fake_png}\n"
        mock_result.stderr = ""

        with patch("subprocess.run", return_value=mock_result):
            result = tool.execute({
                "syntax": "infographic list-row-simple\ndata\n  lists\n    - label A",
                "width": 1920,
                "height": 1080,
            })

        assert result.success is True
        assert "image_path" in result.data

    def test_returns_failure_when_node_nonzero(self):
        tool = self._make_tool()
        mock_result = MagicMock()
        mock_result.returncode = 1
        mock_result.stdout = ""
        mock_result.stderr = "Render error: Cannot find module"

        with patch("subprocess.run", return_value=mock_result):
            result = tool.execute({"syntax": "invalid dsl"})

        assert result.success is False
        assert "Render error" in result.error

    def test_default_dimensions(self):
        tool = self._make_tool()
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = "OK: /tmp/x.png\n"
        mock_result.stderr = ""

        with patch("subprocess.run", return_value=mock_result) as mock_run:
            tool.execute({"syntax": "dsl"})

        cmd = mock_run.call_args[0][0]
        assert "1920" in cmd
        assert "1080" in cmd

    def test_custom_dimensions_passed_to_node(self):
        tool = self._make_tool()
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = "OK: /tmp/x.png\n"
        mock_result.stderr = ""

        with patch("subprocess.run", return_value=mock_result) as mock_run:
            tool.execute({"syntax": "dsl", "width": 1080, "height": 1920})

        cmd = mock_run.call_args[0][0]
        assert "1080" in cmd
        assert "1920" in cmd

    def test_tool_metadata(self):
        tool = self._make_tool()
        assert tool.name == "infographic_png"
        assert tool.capability == "infographic"
        assert tool.provider == "infographic_original"
        assert "cmd:node" in tool.dependencies

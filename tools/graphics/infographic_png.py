"""InfographicPng — @antv/infographic DSL → PNG via Node.js subprocess."""
import hashlib
import subprocess
import time
from pathlib import Path

from tools.base_tool import (
    BaseTool, ToolResult, ToolRuntime, ToolTier, ToolStability,
    ExecutionMode, Determinism, ResumeSupport, ResourceProfile, RetryPolicy,
)

_RENDERER = Path(__file__).parent / "_infographic_renderer.js"


class InfographicPng(BaseTool):
    name = "infographic_png"
    version = "1.0.0"
    capability = "infographic"
    provider = "infographic_original"
    tier = ToolTier.GENERATE
    stability = ToolStability.EXPERIMENTAL
    runtime = ToolRuntime.LOCAL
    execution_mode = ExecutionMode.SYNC
    determinism = Determinism.DETERMINISTIC
    resume_support = ResumeSupport.NONE

    dependencies = ["cmd:node", "python:subprocess"]
    install_instructions = (
        "Run `npm install` in tools/graphics/. "
        "Requires ~/Coding/Infographic-original (optional, fallback used if absent)."
    )
    fallback = None
    fallback_tools = []

    resource_profile = ResourceProfile(
        cpu_cores=1, ram_mb=512, vram_mb=0, disk_mb=5, network_required=False
    )
    retry_policy = RetryPolicy(max_retries=1)
    idempotency_key_fields = ["syntax", "width", "height"]

    input_schema = {
        "type": "object",
        "required": ["syntax"],
        "properties": {
            "syntax": {"type": "string", "description": "@antv/infographic DSL string"},
            "width": {"type": "integer", "default": 1920},
            "height": {"type": "integer", "default": 1080},
        },
    }

    output_schema = {
        "type": "object",
        "properties": {
            "image_path": {"type": "string"},
        },
    }

    def execute(self, inputs: dict) -> ToolResult:
        t0 = time.monotonic()
        syntax = inputs["syntax"]
        width = inputs.get("width", 1920)
        height = inputs.get("height", 1080)

        key = hashlib.sha256(f"{syntax}{width}{height}".encode()).hexdigest()[:12]
        out_path = f"/tmp/infographic_{key}.png"

        try:
            result = subprocess.run(
                ["node", str(_RENDERER), syntax, out_path, str(width), str(height)],
                capture_output=True,
                text=True,
                timeout=30,
            )

            if result.returncode != 0:
                raise RuntimeError(result.stderr.strip() or result.stdout.strip())

            return ToolResult(
                success=True,
                data={"image_path": out_path},
                artifacts=[out_path],
                error=None,
                cost_usd=0.0,
                duration_seconds=time.monotonic() - t0,
                seed=None,
                model=None,
            )
        except Exception as exc:
            return ToolResult(
                success=False,
                data={},
                artifacts=[],
                error=str(exc),
                cost_usd=0.0,
                duration_seconds=time.monotonic() - t0,
                seed=None,
                model=None,
            )

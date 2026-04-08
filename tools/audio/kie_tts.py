# tools/audio/kie_tts.py
"""Kie.ai ElevenLabs TTS turbo-2.5 — BaseTool wrapper."""
import hashlib
import os
import time
import urllib.request
from pathlib import Path

from tools._kie_client import KieAiClient
from tools.base_tool import (
    BaseTool,
    Determinism,
    ExecutionMode,
    ResourceProfile,
    RetryPolicy,
    ResumeSupport,
    ToolResult,
    ToolRuntime,
    ToolStability,
    ToolTier,
)


class KieTts(BaseTool):
    name = "kie_tts"
    version = "1.0.0"
    capability = "tts"
    provider = "kie_ai"
    tier = ToolTier.VOICE
    stability = ToolStability.BETA
    runtime = ToolRuntime.API
    execution_mode = ExecutionMode.SYNC
    determinism = Determinism.STOCHASTIC
    resume_support = ResumeSupport.NONE

    fallback = "piper_tts"
    fallback_tools = ["piper_tts"]
    dependencies = ["env:KIE_API_KEY"]
    install_instructions = "Set KIE_API_KEY in .env (copy from Jarvis .env)"

    resource_profile = ResourceProfile(
        cpu_cores=0, ram_mb=64, vram_mb=0, disk_mb=10, network_required=True
    )
    retry_policy = RetryPolicy(max_retries=2)
    idempotency_key_fields = ["text", "voice", "speed"]

    input_schema = {
        "type": "object",
        "required": ["text"],
        "properties": {
            "text": {"type": "string"},
            "voice": {"type": "string", "default": "Rachel"},
            "speed": {"type": "number", "default": 1.0},
            "language_code": {"type": "string"},
        },
    }

    output_schema = {
        "type": "object",
        "properties": {
            "audio_path": {"type": "string"},
            "duration_seconds": {"type": "number"},
        },
    }

    def estimate_cost(self, inputs: dict) -> float:
        return len(inputs.get("text", "")) / 1000 * 0.003

    def execute(self, inputs: dict) -> ToolResult:
        t0 = time.monotonic()
        text = inputs["text"]
        voice = inputs.get("voice", "Rachel")
        speed = inputs.get("speed", 1.0)

        try:
            client = KieAiClient()
            task_id = client.create_task(
                "elevenlabs/text-to-speech-turbo-2-5",
                {"text": text, "voice": voice, "speed": speed},
            )
            urls = client.poll_task(task_id, timeout=120, interval=2)
            if not urls:
                raise RuntimeError("Kie.ai returned no audio URLs")

            audio_url = urls[0]
            key = hashlib.sha256(f"{text}{voice}{speed}".encode()).hexdigest()[:12]
            out_path = f"/tmp/kie_tts_{key}.mp3"
            urllib.request.urlretrieve(audio_url, out_path)

            return ToolResult(
                success=True,
                data={"audio_path": out_path, "duration_seconds": 0.0},
                artifacts=[out_path],
                error=None,
                cost_usd=self.estimate_cost(inputs),
                duration_seconds=time.monotonic() - t0,
                seed=None,
                model="elevenlabs/text-to-speech-turbo-2-5",
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

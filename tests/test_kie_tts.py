import pytest
from unittest.mock import patch, MagicMock
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


class TestKieTtsExecute:
    def _make_tool(self):
        from tools.audio.kie_tts import KieTts
        return KieTts()

    def test_returns_audio_path_on_success(self, tmp_path):
        tool = self._make_tool()
        with patch("tools.audio.kie_tts.KieAiClient") as MockClient:
            instance = MockClient.return_value
            instance.create_task.return_value = "task-001"
            instance.poll_task.return_value = ["https://example.com/out.mp3"]
            with patch("urllib.request.urlretrieve") as mock_dl:
                def fake_retrieve(url, path):
                    with open(path, "wb") as f:
                        f.write(b"\xff\xfb" + b"\x00" * 100)
                mock_dl.side_effect = fake_retrieve
                result = tool.execute({"text": "Hello world"})
        assert result.success is True
        assert "audio_path" in result.data
        assert result.data["audio_path"].endswith(".mp3")

    def test_uses_rachel_voice_by_default(self):
        tool = self._make_tool()
        with patch("tools.audio.kie_tts.KieAiClient") as MockClient:
            instance = MockClient.return_value
            instance.create_task.return_value = "task-002"
            instance.poll_task.return_value = ["https://example.com/out.mp3"]
            with patch("urllib.request.urlretrieve"):
                tool.execute({"text": "Hi"})
            call_args = instance.create_task.call_args
            input_params = call_args[0][1]
            assert input_params.get("voice") == "Rachel"

    def test_model_passed_to_create_task(self):
        tool = self._make_tool()
        with patch("tools.audio.kie_tts.KieAiClient") as MockClient:
            instance = MockClient.return_value
            instance.create_task.return_value = "task-003"
            instance.poll_task.return_value = ["https://example.com/out.mp3"]
            with patch("urllib.request.urlretrieve"):
                tool.execute({"text": "Hi"})
            model_arg = instance.create_task.call_args[0][0]
            assert model_arg == "elevenlabs/text-to-speech-turbo-2-5"

    def test_returns_failure_on_client_error(self):
        tool = self._make_tool()
        with patch("tools.audio.kie_tts.KieAiClient") as MockClient:
            instance = MockClient.return_value
            instance.create_task.side_effect = RuntimeError("API error")
            result = tool.execute({"text": "Hi"})
        assert result.success is False
        assert "API error" in result.error

    def test_tool_metadata(self):
        tool = self._make_tool()
        assert tool.name == "kie_tts"
        assert tool.capability == "tts"
        assert tool.provider == "kie_ai"
        assert "env:KIE_API_KEY" in tool.dependencies
        assert tool.fallback == "piper_tts"

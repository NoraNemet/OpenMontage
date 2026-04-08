# tests/test_kie_client.py
import pytest
from unittest.mock import patch, MagicMock
import json
import urllib.request

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


class TestKieAiClientCreateTask:
    def test_returns_task_id_string(self):
        from tools._kie_client import KieAiClient
        client = KieAiClient(api_key="test-key")
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.read.return_value = json.dumps({
            "code": 200,
            "data": {"taskId": "abc-123"}
        }).encode()

        with patch("urllib.request.urlopen", return_value=mock_resp):
            task_id = client.create_task(
                model="elevenlabs/text-to-speech-turbo-2-5",
                input_params={"text": "Hello"}
            )
        assert task_id == "abc-123"

    def test_sends_bearer_token(self):
        from tools._kie_client import KieAiClient
        client = KieAiClient(api_key="test-key")
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.read.return_value = json.dumps({
            "code": 200,
            "data": {"taskId": "x"}
        }).encode()

        with patch("urllib.request.urlopen", return_value=mock_resp) as mock_open:
            client.create_task("m", {})

        req = mock_open.call_args[0][0]
        # header_items() returns list of (name, value) tuples, names are title-cased
        headers = dict(req.header_items())
        assert headers.get("Authorization") == "Bearer test-key"

    def test_raises_on_api_error(self):
        from tools._kie_client import KieAiClient
        client = KieAiClient(api_key="test-key")
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.read.return_value = json.dumps({
            "code": 400,
            "message": "Bad request"
        }).encode()

        with patch("urllib.request.urlopen", return_value=mock_resp):
            with pytest.raises(RuntimeError, match="Bad request"):
                client.create_task("model", {})


class TestKieAiClientPollTask:
    def test_returns_url_list_on_success(self):
        from tools._kie_client import KieAiClient
        client = KieAiClient(api_key="test-key")

        inner = json.dumps({"resultUrls": ["https://cdn.kie.ai/out.mp3"]})
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.read.return_value = json.dumps({
            "code": 200,
            "data": {
                "state": "success",
                "resultJson": inner
            }
        }).encode()

        with patch("urllib.request.urlopen", return_value=mock_resp):
            urls = client.poll_task("abc-123", timeout=10, interval=0)
        assert urls == ["https://cdn.kie.ai/out.mp3"]

    def test_raises_timeout(self):
        from tools._kie_client import KieAiClient
        client = KieAiClient(api_key="test-key")

        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.read.return_value = json.dumps({
            "code": 200,
            "data": {"state": "processing", "resultJson": None}
        }).encode()

        # Return increasing values so deadline is immediately exceeded
        _calls = [0.0, 0.5, 10.0]
        call_count = {"n": 0}
        def fake_monotonic():
            n = call_count["n"]
            call_count["n"] += 1
            return _calls[n] if n < len(_calls) else 999.0

        with patch("urllib.request.urlopen", return_value=mock_resp):
            with patch("time.sleep"):
                with patch("time.monotonic", side_effect=fake_monotonic):
                    with pytest.raises(TimeoutError):
                        client.poll_task("abc-123", timeout=1, interval=2)

    def test_returns_url_list_when_result_json_is_dict(self):
        from tools._kie_client import KieAiClient
        client = KieAiClient(api_key="test-key")

        mock_resp = MagicMock()
        mock_resp.status = 200
        # resultJson is already a dict, not a JSON string
        mock_resp.read.return_value = json.dumps({
            "code": 200,
            "data": {
                "state": "success",
                "resultJson": {"resultUrls": ["https://cdn.kie.ai/out2.mp3"]}
            }
        }).encode()

        with patch("urllib.request.urlopen", return_value=mock_resp):
            urls = client.poll_task("abc-999", timeout=10, interval=0)
        assert urls == ["https://cdn.kie.ai/out2.mp3"]

    def test_raises_on_fail_state(self):
        from tools._kie_client import KieAiClient
        client = KieAiClient(api_key="test-key")

        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.read.return_value = json.dumps({
            "code": 200,
            "data": {"state": "fail", "resultJson": None}
        }).encode()

        with patch("urllib.request.urlopen", return_value=mock_resp):
            with pytest.raises(RuntimeError, match="fail"):
                client.poll_task("abc-123", timeout=10, interval=0)

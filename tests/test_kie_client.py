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

        captured_req = {}

        original_Request = urllib.request.Request

        def capture_request(url, data=None, headers=None, method=None):
            req = original_Request(url, data=data, headers=headers or {}, method=method)
            captured_req["req"] = req
            return req

        with patch("urllib.request.Request", side_effect=capture_request):
            with patch("urllib.request.urlopen", return_value=mock_resp):
                client.create_task("m", {})

        assert captured_req["req"].get_header("Authorization") == "Bearer test-key"

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
        monotonic_values = iter([0.0, 0.0, 10.0])

        with patch("urllib.request.urlopen", return_value=mock_resp):
            with patch("time.sleep"):
                with patch("time.monotonic", side_effect=monotonic_values):
                    with pytest.raises(TimeoutError):
                        client.poll_task("abc-123", timeout=1, interval=2)

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

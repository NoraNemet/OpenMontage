# tools/_kie_client.py
"""Shared Kie.ai polling utility — all Kie.ai tools import from here."""
import json
import os
import time
import urllib.request
import urllib.error
from typing import Optional


class KieAiClient:
    base_url = "https://api.kie.ai"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get("KIE_API_KEY", "")
        if not self.api_key:
            raise ValueError("KIE_API_KEY not set and api_key not provided")

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def create_task(self, model: str, input_params: dict) -> str:
        """POST /api/v1/jobs/createTask — returns taskId string."""
        payload = json.dumps({"model": model, "input": input_params}).encode()
        req = urllib.request.Request(
            f"{self.base_url}/api/v1/jobs/createTask",
            data=payload,
            headers=self._headers(),
            method="POST",
        )
        resp = urllib.request.urlopen(req)
        body = json.loads(resp.read())

        if body.get("code") != 200:
            raise RuntimeError(f"Kie.ai createTask error: {body.get('message', body)}")

        return body["data"]["taskId"]

    def poll_task(self, task_id: str, timeout: int = 120, interval: int = 2) -> list:
        """GET /api/v1/jobs/recordInfo — polls until success/fail, returns resultUrls."""
        url = f"{self.base_url}/api/v1/jobs/recordInfo?taskId={task_id}"
        deadline = time.monotonic() + timeout

        while True:
            req = urllib.request.Request(url, headers=self._headers())
            resp = urllib.request.urlopen(req)
            body = json.loads(resp.read())

            if body.get("code") != 200:
                raise RuntimeError(f"Kie.ai poll error: {body.get('message', body)}")

            data = body["data"]
            state = data.get("state", "")

            if state == "success":
                result_json = data.get("resultJson") or "{}"
                parsed = json.loads(result_json) if isinstance(result_json, str) else result_json
                return parsed.get("resultUrls", [])

            if state == "fail":
                raise RuntimeError(f"Kie.ai task {task_id} failed: {data}")

            if time.monotonic() >= deadline:
                raise TimeoutError(f"Kie.ai task {task_id} timed out after {timeout}s")

            time.sleep(interval)

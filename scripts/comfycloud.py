"""Minimal ComfyCloud REST client.

Endpoints (https://docs.comfy.org):
  POST /api/upload/image          multipart  → {name, subfolder, type}
  POST /api/prompt                json       → {prompt_id, ...}
  GET  /api/jobs/{prompt_id}      json       → {status, outputs, ...}
  GET  /api/view?filename=...&type=output    → image bytes
"""
from __future__ import annotations
import os, time
from pathlib import Path
from typing import Any
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

BASE = os.environ.get("COMFYCLOUD_BASE", "https://cloud.comfy.org/api")
KEY = os.environ["COMFYCLOUD_API_KEY"]
HEADERS = {"X-API-Key": KEY}

TERMINAL = {"completed", "failed", "cancelled"}

# Local proxies (clash) sometimes 503 transiently. Retry aggressively.
_S = requests.Session()
_retry = Retry(total=6, backoff_factor=1.5,
               status_forcelist=[502, 503, 504],
               allowed_methods=["GET", "POST"])
_S.mount("https://", HTTPAdapter(max_retries=_retry))


def upload_image(path: Path) -> str:
    with path.open("rb") as f:
        r = _S.post(
            f"{BASE}/upload/image",
            headers=HEADERS,
            files={"image": (path.name, f, "application/octet-stream")},
            timeout=60,
        )
    r.raise_for_status()
    return r.json()["name"]


def submit(workflow: dict[str, Any]) -> str:
    # Partner API nodes (Gemini/OpenAI/etc.) require api_key_comfy_org in
    # extra_data so the server can authorize the third-party backend call
    # and bill credits to this account.
    r = _S.post(
        f"{BASE}/prompt",
        headers={**HEADERS, "Content-Type": "application/json"},
        json={
            "prompt": workflow,
            "extra_data": {"api_key_comfy_org": KEY},
        },
        timeout=30,
    )
    r.raise_for_status()
    return r.json()["prompt_id"]


def poll(prompt_id: str, *, interval: float = 3.0, timeout: float = 600.0) -> dict:
    deadline = time.time() + timeout
    backoff = 1.0
    while time.time() < deadline:
        try:
            r = _S.get(f"{BASE}/jobs/{prompt_id}", headers=HEADERS, timeout=30)
            r.raise_for_status()
            d = r.json()
            backoff = 1.0
            if d.get("status") in TERMINAL:
                return d
        except requests.exceptions.RequestException as e:
            print(f"  poll transient error ({type(e).__name__}); retrying in {backoff:.1f}s")
            time.sleep(backoff)
            backoff = min(backoff * 2, 30.0)
            continue
        time.sleep(interval)
    raise TimeoutError(f"job {prompt_id} did not finish within {timeout}s")


def download_view(filename: str, subfolder: str = "", type_: str = "output") -> bytes:
    r = _S.get(
        f"{BASE}/view",
        headers=HEADERS,
        params={"filename": filename, "subfolder": subfolder, "type": type_},
        timeout=120,
    )
    r.raise_for_status()
    return r.content


def extract_outputs(job: dict) -> list[tuple[str, str, str]]:
    """Return list of (filename, subfolder, type) for every image output."""
    out = []
    for node_id, node_out in (job.get("outputs") or {}).items():
        for img in node_out.get("images") or []:
            out.append((img["filename"], img.get("subfolder", ""), img.get("type", "output")))
    return out

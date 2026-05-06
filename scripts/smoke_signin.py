"""Smoke test: boot Streamlit on a free port, hit / and assert 200 + sign-in card.

Streamlit + Sheets needs no DB; we only check that the Streamlit process boots
and renders something. Auth bypass via STREAMLIT_TEST_BYPASS_AUTH=1 to skip the
password gate during smoke (per signin-test.md kind=streamlit-shared-password).
"""
from __future__ import annotations

import os
import socket
import subprocess
import sys
import time
from pathlib import Path

import requests

REPO_ROOT = Path(__file__).resolve().parent.parent


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def main() -> int:
    port = _free_port()
    py = sys.executable
    cmd = [
        py,
        "-m",
        "streamlit",
        "run",
        str(REPO_ROOT / "streamlit_app.py"),
        "--server.headless=true",
        f"--server.port={port}",
        "--server.address=127.0.0.1",
        "--browser.gatherUsageStats=false",
    ]
    env = os.environ.copy()
    # Bypass auth so we can detect a non-error 200 page even without secrets
    env["STREAMLIT_TEST_BYPASS_AUTH"] = "1"
    print(f"smoke: launching streamlit on port {port}...")
    proc = subprocess.Popen(cmd, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=str(REPO_ROOT))

    url = f"http://127.0.0.1:{port}/"
    deadline = time.monotonic() + 60
    last_err = None
    ok = False
    try:
        while time.monotonic() < deadline:
            time.sleep(2)
            try:
                r = requests.get(url, timeout=5)
                if r.status_code == 200 and ("Streamlit" in r.text or "<html" in r.text.lower()):
                    print(f"smoke: GET / -> 200 (len={len(r.text)})")
                    ok = True
                    break
                last_err = f"HTTP {r.status_code}, len={len(r.text)}"
            except Exception as e:  # noqa: BLE001
                last_err = str(e)
        if not ok:
            print(f"smoke: FAILED — last error: {last_err}")
            stdout, stderr = proc.communicate(timeout=5)
            print("--- stdout ---")
            print(stdout.decode(errors="replace")[-3000:])
            print("--- stderr ---")
            print(stderr.decode(errors="replace")[-3000:])
            return 1
        print("smoke: OK — Streamlit serves /")
        return 0
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()


if __name__ == "__main__":
    sys.exit(main())

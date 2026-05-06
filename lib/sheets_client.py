"""gspread wrapper with caching, locking, and retry.

Service account JSON read from st.secrets["gcp_service_account"].
Spreadsheet URL read from st.secrets["SHEETS_URL"] OR Settings tab.
"""
from __future__ import annotations

import contextlib
import os
import time
from datetime import datetime
from typing import Iterable, Iterator, Optional

import pandas as pd
import streamlit as st

# We import gspread/google-auth inside functions so this module is importable in
# the smoke environment even when credentials aren't set.

LOCKS_TAB = "_locks"
TELEGRAM_OFFSET_TAB = "_telegram_offset"

_RETRY_STATUS_CODES = (429, 500, 502, 503, 504)
_MAX_RETRIES = 3
_BASE_BACKOFF_SEC = 1.0
_LOCK_TIMEOUT_SEC = 30
_LOCK_POLL_SEC = 0.5


class SheetsConfigError(RuntimeError):
    pass


class SheetsLockTimeout(RuntimeError):
    pass


def _get_secret(key: str, default: str = "") -> str:
    try:
        v = st.secrets.get(key, "")
        if v:
            return str(v)
    except (FileNotFoundError, KeyError, AttributeError):
        pass
    return os.environ.get(key, default)


def _get_service_account_dict() -> dict:
    try:
        sa = st.secrets.get("gcp_service_account", None)
        if sa:
            return dict(sa)
    except (FileNotFoundError, KeyError, AttributeError):
        pass
    # env fallback (single JSON in env var)
    raw = os.environ.get("GCP_SERVICE_ACCOUNT_JSON", "")
    if raw:
        import json

        try:
            return json.loads(raw)
        except json.JSONDecodeError as e:
            raise SheetsConfigError(f"GCP_SERVICE_ACCOUNT_JSON is not valid JSON: {e}") from e
    raise SheetsConfigError(
        "Missing gcp_service_account secret. See .streamlit/secrets.toml.example."
    )


@st.cache_resource(show_spinner=False)
def _client():
    """Return an authorized gspread client. Cached for the session."""
    import gspread
    from google.oauth2.service_account import Credentials

    sa = _get_service_account_dict()
    scopes = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
    ]
    creds = Credentials.from_service_account_info(sa, scopes=scopes)
    return gspread.authorize(creds)


@st.cache_resource(show_spinner=False)
def _spreadsheet():
    url = _get_secret("SHEETS_URL")
    if not url:
        raise SheetsConfigError("Missing SHEETS_URL secret.")
    cli = _client()
    if "/d/" in url:
        return cli.open_by_url(url)
    return cli.open(url)


def _retry(callable_fn, *args, **kwargs):
    last_exc: Optional[Exception] = None
    for attempt in range(_MAX_RETRIES):
        try:
            return callable_fn(*args, **kwargs)
        except Exception as e:  # noqa: BLE001
            last_exc = e
            text = str(e).lower()
            transient = any(str(c) in text for c in _RETRY_STATUS_CODES) or "rate" in text
            if not transient:
                raise
            time.sleep(_BASE_BACKOFF_SEC * (2**attempt))
    if last_exc:
        raise last_exc


def list_tabs() -> list[str]:
    return [ws.title for ws in _spreadsheet().worksheets()]


@st.cache_data(ttl=60, show_spinner=False)
def read_tab(name: str) -> pd.DataFrame:
    """Read tab as DataFrame. 60s cache. Returns empty DataFrame on missing tab."""
    try:
        ss = _spreadsheet()
        ws = ss.worksheet(name)
        rows = _retry(ws.get_all_records)
        if not rows:
            # Header-only tab: return empty df with the headers as columns
            headers = _retry(ws.row_values, 1)
            return pd.DataFrame(columns=headers)
        return pd.DataFrame(rows)
    except SheetsConfigError:
        return pd.DataFrame()
    except Exception as e:  # noqa: BLE001
        st.warning(f"Sheets read warning ({name}): {e}")
        return pd.DataFrame()


def clear_cache() -> None:
    """Bust the read_tab cache. Call after writes that need immediate visibility."""
    try:
        read_tab.clear()
    except Exception:
        pass


def _next_id(df: pd.DataFrame) -> int:
    if df.empty or "id" not in df.columns:
        return 1
    try:
        return int(pd.to_numeric(df["id"], errors="coerce").max() or 0) + 1
    except (ValueError, TypeError):
        return 1


def append_row(name: str, row: dict) -> int:
    """Append a row to a tab. Auto-assigns `id` if column present and not set.

    Returns the assigned id (or -1 if the tab has no id column).
    """
    ss = _spreadsheet()
    ws = ss.worksheet(name)
    headers = _retry(ws.row_values, 1)
    if not headers:
        raise SheetsConfigError(f"Tab '{name}' has no header row.")
    # Auto-assign id if missing
    if "id" in headers and not row.get("id"):
        existing = read_tab(name)
        row = {**row, "id": _next_id(existing)}
    values = [row.get(h, "") for h in headers]
    _retry(ws.append_row, values, value_input_option="USER_ENTERED")
    clear_cache()
    return int(row.get("id") or -1)


def append_rows(name: str, rows: list[dict]) -> int:
    """Batch append rows. Returns count appended."""
    if not rows:
        return 0
    ss = _spreadsheet()
    ws = ss.worksheet(name)
    headers = _retry(ws.row_values, 1)
    if not headers:
        raise SheetsConfigError(f"Tab '{name}' has no header row.")
    # Auto-assign ids if missing
    if "id" in headers:
        existing = read_tab(name)
        next_id = _next_id(existing)
        out_rows = []
        for r in rows:
            if not r.get("id"):
                r = {**r, "id": next_id}
                next_id += 1
            out_rows.append(r)
        rows = out_rows
    values = [[r.get(h, "") for h in headers] for r in rows]
    _retry(ws.append_rows, values, value_input_option="USER_ENTERED")
    clear_cache()
    return len(rows)


def update_row(name: str, row_id: int, patch: dict) -> bool:
    """Update a row by id. Returns True if a row was matched and updated."""
    ss = _spreadsheet()
    ws = ss.worksheet(name)
    headers = _retry(ws.row_values, 1)
    if "id" not in headers:
        raise SheetsConfigError(f"Tab '{name}' has no id column.")
    all_rows = _retry(ws.get_all_values)
    # Row 0 = headers
    target_row_idx = None
    id_col_idx = headers.index("id")
    for i, row in enumerate(all_rows[1:], start=2):  # 1-indexed in Sheets
        if row and len(row) > id_col_idx:
            try:
                if int(float(row[id_col_idx])) == int(row_id):
                    target_row_idx = i
                    break
            except (ValueError, TypeError):
                continue
    if target_row_idx is None:
        return False
    # Build the updated row, preserving unchanged values
    current = all_rows[target_row_idx - 1]
    updated = list(current) + [""] * max(0, len(headers) - len(current))
    for col, val in patch.items():
        if col in headers:
            updated[headers.index(col)] = "" if val is None else str(val)
    rng = f"A{target_row_idx}:{_col_letter(len(headers))}{target_row_idx}"
    _retry(ws.update, rng, [updated], value_input_option="USER_ENTERED")
    clear_cache()
    return True


def _col_letter(n: int) -> str:
    s = ""
    while n > 0:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s


def delete_rows_where(name: str, predicate: dict) -> int:
    """Delete rows where every key/value in predicate matches. Returns count deleted.

    Used cautiously — primarily for Recipe replace flow (delete then insert).
    """
    ss = _spreadsheet()
    ws = ss.worksheet(name)
    headers = _retry(ws.row_values, 1)
    all_rows = _retry(ws.get_all_values)
    # Find matching rows (1-indexed in sheets)
    targets = []
    for i, row in enumerate(all_rows[1:], start=2):
        if not row:
            continue
        match = True
        for k, v in predicate.items():
            if k not in headers:
                match = False
                break
            ci = headers.index(k)
            cell = row[ci] if ci < len(row) else ""
            if str(cell) != str(v):
                match = False
                break
        if match:
            targets.append(i)
    # Delete bottom-up
    for idx in sorted(targets, reverse=True):
        _retry(ws.delete_rows, idx)
    clear_cache()
    return len(targets)


@contextlib.contextmanager
def with_lock(lock_name: str, locked_by: str = "system") -> Iterator[None]:
    """Acquire a Sheets-based marker lock. Times out after ~30s.

    Lock state lives in the _locks tab (lock_name, locked_at, locked_by).
    """
    ss = _spreadsheet()
    try:
        ws = ss.worksheet(LOCKS_TAB)
    except Exception:
        # If the locks tab doesn't exist, we can't lock. Behave as no-op.
        yield
        return
    deadline = time.monotonic() + _LOCK_TIMEOUT_SEC
    acquired = False
    while time.monotonic() < deadline:
        try:
            existing = _retry(ws.get_all_records)
            held = any(str(r.get("lock_name")) == lock_name for r in existing)
        except Exception:
            held = False
        if not held:
            try:
                _retry(
                    ws.append_row,
                    [lock_name, datetime.now().isoformat(timespec="seconds"), locked_by],
                    value_input_option="USER_ENTERED",
                )
                acquired = True
                break
            except Exception:
                time.sleep(_LOCK_POLL_SEC)
                continue
        time.sleep(_LOCK_POLL_SEC)
    if not acquired:
        raise SheetsLockTimeout(f"Could not acquire lock '{lock_name}' in {_LOCK_TIMEOUT_SEC}s.")
    try:
        yield
    finally:
        # Release: delete rows for our lock_name
        try:
            delete_rows_where(LOCKS_TAB, {"lock_name": lock_name})
        except Exception:
            pass


def ensure_tab(name: str, headers: Iterable[str]) -> bool:
    """Idempotent: create tab + write headers if missing. Returns True if created."""
    ss = _spreadsheet()
    headers = list(headers)
    titles = list_tabs()
    if name in titles:
        ws = ss.worksheet(name)
        existing_headers = _retry(ws.row_values, 1)
        if not existing_headers:
            _retry(ws.update, f"A1:{_col_letter(len(headers))}1", [headers])
        return False
    ws = _retry(ss.add_worksheet, title=name, rows=200, cols=max(len(headers), 6))
    _retry(ws.update, f"A1:{_col_letter(len(headers))}1", [headers])
    return True


def get_telegram_offset() -> int:
    """Return the last-processed Telegram update_id offset (or 0)."""
    df = read_tab(TELEGRAM_OFFSET_TAB)
    if df.empty:
        return 0
    try:
        return int(pd.to_numeric(df["offset_int"], errors="coerce").max() or 0)
    except Exception:
        return 0


def set_telegram_offset(new_offset: int) -> None:
    ss = _spreadsheet()
    try:
        ws = ss.worksheet(TELEGRAM_OFFSET_TAB)
    except Exception:
        ensure_tab(TELEGRAM_OFFSET_TAB, ["offset_int", "updated_at"])
        ws = ss.worksheet(TELEGRAM_OFFSET_TAB)
    rows = _retry(ws.get_all_values)
    now = datetime.now().isoformat(timespec="seconds")
    if len(rows) <= 1:
        _retry(
            ws.append_row,
            [str(new_offset), now],
            value_input_option="USER_ENTERED",
        )
    else:
        _retry(ws.update, "A2:B2", [[str(new_offset), now]], value_input_option="USER_ENTERED")
    clear_cache()

"""Audit log helper. Every mutation should call log_action()."""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Optional

from lib import sheets_client


def log_action(
    actor_role: str,
    action: str,
    target_kind: Optional[str] = None,
    target_id: Optional[int] = None,
    diff: Optional[Any] = None,
) -> None:
    """Append an AuditLog row. Best-effort — never raises to caller."""
    try:
        diff_str = ""
        if diff is not None:
            if isinstance(diff, str):
                diff_str = diff
            else:
                diff_str = json.dumps(diff, ensure_ascii=False, default=str)
        sheets_client.append_row(
            "AuditLog",
            {
                "occurred_at": datetime.now().isoformat(timespec="seconds"),
                "actor_role": actor_role or "system",
                "action": action,
                "target_kind": target_kind or "",
                "target_id": target_id if target_id is not None else "",
                "diff": diff_str,
            },
        )
    except Exception as e:  # noqa: BLE001
        # Do not break the caller's flow on audit failure
        print(f"audit warning: {e}")

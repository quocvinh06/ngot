"""Vietnamese number/date formatting helpers."""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Union

Number = Union[int, float, Decimal, str, None]


def round_vnd(amount: Number) -> int:
    """Round to nearest 1000 VND (Vietnamese commercial convention)."""
    if amount is None or amount == "":
        return 0
    try:
        value = float(amount)
    except (ValueError, TypeError):
        return 0
    return int(round(value / 1000.0) * 1000)


def format_vnd(amount: Number, with_symbol: bool = True) -> str:
    """Format amount as Vietnamese VND with thousands separator (.) and ₫ symbol.

    Examples:
        format_vnd(1234567) -> "1.234.567 ₫"
        format_vnd(1234567, with_symbol=False) -> "1.234.567"
    """
    if amount is None or amount == "":
        return "0 ₫" if with_symbol else "0"
    try:
        value = round_vnd(amount)
    except (ValueError, TypeError):
        value = 0
    formatted = f"{value:,}".replace(",", ".")
    return f"{formatted} ₫" if with_symbol else formatted


def format_date_vi(value: Union[date, datetime, str, None]) -> str:
    """Format a date/datetime as dd/MM/yyyy."""
    if value is None or value == "":
        return ""
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return value
        return parsed.strftime("%d/%m/%Y")
    if isinstance(value, datetime):
        return value.strftime("%d/%m/%Y")
    if isinstance(value, date):
        return value.strftime("%d/%m/%Y")
    return str(value)


def format_datetime_vi(value: Union[datetime, str, None]) -> str:
    """Format a datetime as dd/MM/yyyy HH:MM."""
    if value is None or value == "":
        return ""
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return value
        return parsed.strftime("%d/%m/%Y %H:%M")
    if isinstance(value, datetime):
        return value.strftime("%d/%m/%Y %H:%M")
    return str(value)


def normalize_vn_phone(raw: str) -> str:
    """Normalize a VN phone to +84xxxxxxxxx (strips spaces, hyphens, parens)."""
    if not raw:
        return ""
    digits = "".join(c for c in str(raw) if c.isdigit())
    if not digits:
        return ""
    if digits.startswith("84"):
        return "+" + digits
    if digits.startswith("0"):
        return "+84" + digits[1:]
    if digits.startswith("+84"):
        return digits
    return "+84" + digits


def mask_phone(raw: str) -> str:
    """Mask middle 4 digits of a VN phone for log display: +84xx****xxx."""
    p = normalize_vn_phone(raw)
    if len(p) < 8:
        return "***"
    return p[:5] + "****" + p[-3:]

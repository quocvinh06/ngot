"""Pydantic models mirroring design.md §2 entities.

Round-trip helpers for pandas Series ↔ Model.
"""
from __future__ import annotations

import json as _json
from datetime import datetime
from decimal import Decimal
from typing import Any, ClassVar, Optional, TypeVar

import pandas as pd
from pydantic import BaseModel, ConfigDict, Field


def _coerce_int(v: Any) -> Optional[int]:
    if v in (None, "", "None"):
        return None
    try:
        return int(float(v))
    except (ValueError, TypeError):
        return None


def _coerce_decimal(v: Any) -> Optional[Decimal]:
    if v in (None, "", "None"):
        return None
    try:
        return Decimal(str(v))
    except Exception:
        return None


def _coerce_bool(v: Any) -> bool:
    if isinstance(v, bool):
        return v
    if v in (None, "", "None"):
        return False
    s = str(v).strip().upper()
    return s in ("TRUE", "1", "YES", "Y", "T")


def _coerce_str(v: Any) -> str:
    if v in (None, "None"):
        return ""
    return str(v)


def _coerce_dt(v: Any) -> Optional[datetime]:
    if v in (None, "", "None"):
        return None
    if isinstance(v, datetime):
        return v
    try:
        return datetime.fromisoformat(str(v).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None


def _coerce_json(v: Any) -> Any:
    if v in (None, "", "None"):
        return None
    if isinstance(v, (list, dict)):
        return v
    try:
        return _json.loads(str(v))
    except (ValueError, TypeError):
        return None


EntityT = TypeVar("EntityT", bound="Entity")


class Entity(BaseModel):
    """Base entity with id + simple from_row / to_row support."""

    model_config = ConfigDict(arbitrary_types_allowed=True, extra="ignore")

    id: Optional[int] = None

    # Subclasses define their column → coercer mapping.
    _coercers: ClassVar[dict[str, Any]] = {"id": _coerce_int}

    @classmethod
    def from_row(cls: type["EntityT"], row: pd.Series) -> "EntityT":
        kwargs: dict[str, Any] = {}
        for field, coercer in cls._coercers.items():
            kwargs[field] = coercer(row.get(field))
        return cls(**kwargs)

    def to_row(self) -> dict[str, Any]:
        out: dict[str, Any] = {}
        for field in self._coercers.keys():
            v = getattr(self, field, None)
            if isinstance(v, datetime):
                out[field] = v.isoformat(timespec="seconds")
            elif isinstance(v, Decimal):
                out[field] = str(v)
            elif isinstance(v, bool):
                out[field] = "TRUE" if v else "FALSE"
            elif isinstance(v, (list, dict)):
                out[field] = _json.dumps(v, ensure_ascii=False)
            elif v is None:
                out[field] = ""
            else:
                out[field] = str(v)
        return out


class Customer(Entity):
    phone: str = ""
    name: str = ""
    default_address: Optional[str] = None
    ward: Optional[str] = None
    district: Optional[str] = None
    city: Optional[str] = None
    notes: Optional[str] = None
    consent_pdpl: bool = False
    consent_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    created_by: str = "staff"

    _coercers: ClassVar[dict[str, Any]] = {
        "id": _coerce_int,
        "phone": _coerce_str,
        "name": _coerce_str,
        "default_address": _coerce_str,
        "ward": _coerce_str,
        "district": _coerce_str,
        "city": _coerce_str,
        "notes": _coerce_str,
        "consent_pdpl": _coerce_bool,
        "consent_at": _coerce_dt,
        "created_at": _coerce_dt,
        "created_by": _coerce_str,
    }


class Dish(Entity):
    name_vi: str = ""
    name_en: Optional[str] = None
    category: str = "cake"
    price_vnd: Decimal = Decimal("0")
    size: Optional[str] = None
    description_vi: Optional[str] = None
    image_url: Optional[str] = None
    is_active: bool = True
    retired_at: Optional[datetime] = None
    display_order: Optional[int] = None
    allergens: Optional[list] = None

    _coercers: ClassVar[dict[str, Any]] = {
        "id": _coerce_int,
        "name_vi": _coerce_str,
        "name_en": _coerce_str,
        "category": _coerce_str,
        "price_vnd": _coerce_decimal,
        "size": _coerce_str,
        "description_vi": _coerce_str,
        "image_url": _coerce_str,
        "is_active": _coerce_bool,
        "retired_at": _coerce_dt,
        "display_order": _coerce_int,
        "allergens": _coerce_json,
    }


class Ingredient(Entity):
    name_vi: str = ""
    unit: str = "g"
    current_stock: Decimal = Decimal("0")
    reorder_threshold: Optional[Decimal] = None
    last_purchase_price_vnd: Optional[Decimal] = None
    weighted_avg_cost_vnd: Optional[Decimal] = None
    supplier_name: Optional[str] = None
    supplier_phone: Optional[str] = None
    notes: Optional[str] = None

    _coercers: ClassVar[dict[str, Any]] = {
        "id": _coerce_int,
        "name_vi": _coerce_str,
        "unit": _coerce_str,
        "current_stock": _coerce_decimal,
        "reorder_threshold": _coerce_decimal,
        "last_purchase_price_vnd": _coerce_decimal,
        "weighted_avg_cost_vnd": _coerce_decimal,
        "supplier_name": _coerce_str,
        "supplier_phone": _coerce_str,
        "notes": _coerce_str,
    }


class Recipe(Entity):
    dish_id: int = 0
    ingredient_id: int = 0
    quantity: Decimal = Decimal("0")
    unit: str = "g"
    notes_vi: Optional[str] = None

    _coercers: ClassVar[dict[str, Any]] = {
        "id": _coerce_int,
        "dish_id": _coerce_int,
        "ingredient_id": _coerce_int,
        "quantity": _coerce_decimal,
        "unit": _coerce_str,
        "notes_vi": _coerce_str,
    }


class Order(Entity):
    customer_id: int = 0
    status: str = "draft"
    order_date: Optional[datetime] = None
    delivery_date: Optional[datetime] = None
    delivery_address: Optional[str] = None
    subtotal_vnd: Decimal = Decimal("0")
    discount_kind: str = "none"
    discount_value: Optional[Decimal] = None
    campaign_id: Optional[int] = None
    total_vnd: Decimal = Decimal("0")
    paid_at: Optional[datetime] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None
    source: str = "manual"
    confirmed_at: Optional[datetime] = None
    created_by: str = "staff"

    _coercers: ClassVar[dict[str, Any]] = {
        "id": _coerce_int,
        "customer_id": _coerce_int,
        "status": _coerce_str,
        "order_date": _coerce_dt,
        "delivery_date": _coerce_dt,
        "delivery_address": _coerce_str,
        "subtotal_vnd": _coerce_decimal,
        "discount_kind": _coerce_str,
        "discount_value": _coerce_decimal,
        "campaign_id": _coerce_int,
        "total_vnd": _coerce_decimal,
        "paid_at": _coerce_dt,
        "payment_method": _coerce_str,
        "notes": _coerce_str,
        "source": _coerce_str,
        "confirmed_at": _coerce_dt,
        "created_by": _coerce_str,
    }


class OrderItem(Entity):
    order_id: int = 0
    dish_id: int = 0
    dish_name_snapshot: str = ""
    quantity: int = 1
    unit_price_vnd: Decimal = Decimal("0")
    subtotal_vnd: Decimal = Decimal("0")
    notes: Optional[str] = None

    _coercers: ClassVar[dict[str, Any]] = {
        "id": _coerce_int,
        "order_id": _coerce_int,
        "dish_id": _coerce_int,
        "dish_name_snapshot": _coerce_str,
        "quantity": _coerce_int,
        "unit_price_vnd": _coerce_decimal,
        "subtotal_vnd": _coerce_decimal,
        "notes": _coerce_str,
    }


class InventoryMovement(Entity):
    occurred_at: Optional[datetime] = None
    ingredient_id: int = 0
    kind: str = "purchase"
    quantity: Decimal = Decimal("0")
    unit_price_vnd: Optional[Decimal] = None
    total_vnd: Optional[Decimal] = None
    related_order_id: Optional[int] = None
    notes: Optional[str] = None
    recorded_by: str = "staff"

    _coercers: ClassVar[dict[str, Any]] = {
        "id": _coerce_int,
        "occurred_at": _coerce_dt,
        "ingredient_id": _coerce_int,
        "kind": _coerce_str,
        "quantity": _coerce_decimal,
        "unit_price_vnd": _coerce_decimal,
        "total_vnd": _coerce_decimal,
        "related_order_id": _coerce_int,
        "notes": _coerce_str,
        "recorded_by": _coerce_str,
    }


class Equipment(Entity):
    name_vi: str = ""
    purchased_at: Optional[datetime] = None
    purchase_price_vnd: Decimal = Decimal("0")
    useful_life_months: int = 60
    salvage_value_vnd: Decimal = Decimal("0")
    monthly_depreciation_vnd: Decimal = Decimal("0")
    is_active: bool = True
    notes: Optional[str] = None

    _coercers: ClassVar[dict[str, Any]] = {
        "id": _coerce_int,
        "name_vi": _coerce_str,
        "purchased_at": _coerce_dt,
        "purchase_price_vnd": _coerce_decimal,
        "useful_life_months": _coerce_int,
        "salvage_value_vnd": _coerce_decimal,
        "monthly_depreciation_vnd": _coerce_decimal,
        "is_active": _coerce_bool,
        "notes": _coerce_str,
    }


class Campaign(Entity):
    name_vi: str = ""
    discount_kind: str = "pct"
    discount_value: Decimal = Decimal("0")
    applies_to: str = "all"
    applies_to_value: Optional[str] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    is_active: bool = True
    stack_with_others: bool = False

    _coercers: ClassVar[dict[str, Any]] = {
        "id": _coerce_int,
        "name_vi": _coerce_str,
        "discount_kind": _coerce_str,
        "discount_value": _coerce_decimal,
        "applies_to": _coerce_str,
        "applies_to_value": _coerce_str,
        "starts_at": _coerce_dt,
        "ends_at": _coerce_dt,
        "is_active": _coerce_bool,
        "stack_with_others": _coerce_bool,
    }


class TelegramMessage(Entity):
    telegram_msg_id: int = 0
    chat_id: int = 0
    sender_name: Optional[str] = None
    sender_phone: Optional[str] = None
    received_at: Optional[datetime] = None
    raw_text: str = ""
    parse_status: str = "pending"
    parsed_json: Optional[str] = None
    related_order_id: Optional[int] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None

    _coercers: ClassVar[dict[str, Any]] = {
        "id": _coerce_int,
        "telegram_msg_id": _coerce_int,
        "chat_id": _coerce_int,
        "sender_name": _coerce_str,
        "sender_phone": _coerce_str,
        "received_at": _coerce_dt,
        "raw_text": _coerce_str,
        "parse_status": _coerce_str,
        "parsed_json": _coerce_str,
        "related_order_id": _coerce_int,
        "reviewed_by": _coerce_str,
        "reviewed_at": _coerce_dt,
    }


class AssistantSkill(Entity):
    name: str = ""
    display_name_vi: str = ""
    trigger: str = "manual_button"
    event_kind: Optional[str] = None
    prompt_template: str = ""
    output_schema: Optional[Any] = None
    is_enabled: bool = True
    updated_at: Optional[datetime] = None

    _coercers: ClassVar[dict[str, Any]] = {
        "id": _coerce_int,
        "name": _coerce_str,
        "display_name_vi": _coerce_str,
        "trigger": _coerce_str,
        "event_kind": _coerce_str,
        "prompt_template": _coerce_str,
        "output_schema": _coerce_json,
        "is_enabled": _coerce_bool,
        "updated_at": _coerce_dt,
    }


class AssistantCallLog(Entity):
    skill_id: int = 0
    invoked_at: Optional[datetime] = None
    invoked_by: str = "staff"
    input_text: str = ""
    output_text: Optional[str] = None
    token_count_input: Optional[int] = None
    token_count_output: Optional[int] = None
    latency_ms: Optional[int] = None
    status: str = "ok"
    error_message: Optional[str] = None

    _coercers: ClassVar[dict[str, Any]] = {
        "id": _coerce_int,
        "skill_id": _coerce_int,
        "invoked_at": _coerce_dt,
        "invoked_by": _coerce_str,
        "input_text": _coerce_str,
        "output_text": _coerce_str,
        "token_count_input": _coerce_int,
        "token_count_output": _coerce_int,
        "latency_ms": _coerce_int,
        "status": _coerce_str,
        "error_message": _coerce_str,
    }


class Setting(Entity):
    key: str = ""
    value: Optional[str] = None
    is_secret: bool = False
    updated_at: Optional[datetime] = None
    updated_by: str = "system"

    _coercers: ClassVar[dict[str, Any]] = {
        "id": _coerce_int,
        "key": _coerce_str,
        "value": _coerce_str,
        "is_secret": _coerce_bool,
        "updated_at": _coerce_dt,
        "updated_by": _coerce_str,
    }


class AuditLogEntry(Entity):
    occurred_at: Optional[datetime] = None
    actor_role: str = "system"
    action: str = ""
    target_kind: Optional[str] = None
    target_id: Optional[int] = None
    diff: Optional[str] = None

    _coercers: ClassVar[dict[str, Any]] = {
        "id": _coerce_int,
        "occurred_at": _coerce_dt,
        "actor_role": _coerce_str,
        "action": _coerce_str,
        "target_kind": _coerce_str,
        "target_id": _coerce_int,
        "diff": _coerce_str,
    }


# Order → ParsedOrder for Gemini structured output
class ParsedOrderItem(BaseModel):
    dish_name: str
    quantity: int = 1
    notes: str = ""


class ParsedOrder(BaseModel):
    """Structured output schema for Gemini parse_order skill."""

    customer_phone: str = Field(default="", description="Vietnamese phone number; '' if unknown")
    customer_name: str = Field(default="", description="Customer name as written in message")
    items: list[ParsedOrderItem] = Field(default_factory=list)
    delivery_date: str = Field(default="", description="ISO 8601 date or empty")
    delivery_address: str = Field(default="")
    notes: str = Field(default="")
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)

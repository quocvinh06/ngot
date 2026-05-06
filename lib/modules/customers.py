"""Customers module — find/create with phone-keyed lookup, LTV aggregation."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

import pandas as pd

from lib import sheets_client
from lib.audit import log_action
from lib.format_vi import normalize_vn_phone
from lib.models import Customer


def list_customers() -> pd.DataFrame:
    return sheets_client.read_tab("Customers")


def find_by_phone(phone: str) -> Optional[Customer]:
    if not phone:
        return None
    df = list_customers()
    if df.empty or "phone" not in df.columns:
        return None
    target = normalize_vn_phone(phone)
    matches = df[df["phone"].astype(str).map(normalize_vn_phone) == target]
    if matches.empty:
        return None
    return Customer.from_row(matches.iloc[0])


def get(customer_id: int) -> Optional[Customer]:
    df = list_customers()
    if df.empty:
        return None
    matches = df[pd.to_numeric(df["id"], errors="coerce") == int(customer_id)]
    if matches.empty:
        return None
    return Customer.from_row(matches.iloc[0])


def create(
    *,
    phone: str,
    name: str,
    address: str = "",
    ward: str = "",
    district: str = "",
    city: str = "",
    notes: str = "",
    consent_pdpl: bool = False,
    actor_role: str = "staff",
) -> Customer:
    """Create a Customer. Refuses if consent_pdpl=False (PDPL gate)."""
    if not consent_pdpl:
        raise ValueError("PDPL consent required to store personal data.")
    if not phone:
        raise ValueError("Phone is required.")
    if not name:
        raise ValueError("Name is required.")
    norm = normalize_vn_phone(phone)
    existing = find_by_phone(norm)
    if existing:
        return existing
    now = datetime.now()
    cust = Customer(
        phone=norm,
        name=name,
        default_address=address or None,
        ward=ward or None,
        district=district or None,
        city=city or None,
        notes=notes or None,
        consent_pdpl=consent_pdpl,
        consent_at=now if consent_pdpl else None,
        created_at=now,
        created_by=actor_role,
    )
    new_id = sheets_client.append_row("Customers", cust.to_row())
    cust.id = new_id
    log_action(
        actor_role,
        "customer.create",
        target_kind="Customer",
        target_id=new_id,
        diff={"phone_masked": norm[:5] + "****" + norm[-3:], "name": name},
    )
    return cust


def update(customer_id: int, patch: dict, actor_role: str = "staff") -> bool:
    ok = sheets_client.update_row("Customers", customer_id, patch)
    if ok:
        safe_patch = {k: v for k, v in patch.items() if k not in ("phone",)}
        log_action(
            actor_role,
            "customer.update",
            target_kind="Customer",
            target_id=customer_id,
            diff=safe_patch,
        )
    return ok


def aggregate_ltv(customer_id: int) -> dict:
    """Return {orders_count, total_spend_vnd, last_order_date}."""
    orders = sheets_client.read_tab("Orders")
    if orders.empty or "customer_id" not in orders.columns:
        return {"orders_count": 0, "total_spend_vnd": 0, "last_order_date": ""}
    matches = orders[
        (pd.to_numeric(orders["customer_id"], errors="coerce") == int(customer_id))
        & (orders["status"].astype(str).isin(["confirmed", "in_progress", "ready", "delivered"]))
    ]
    if matches.empty:
        return {"orders_count": 0, "total_spend_vnd": 0, "last_order_date": ""}
    total = pd.to_numeric(matches["total_vnd"], errors="coerce").sum()
    last = matches["order_date"].astype(str).max()
    return {
        "orders_count": int(len(matches)),
        "total_spend_vnd": int(total or 0),
        "last_order_date": last,
    }


def list_with_ltv() -> pd.DataFrame:
    """Return customers DataFrame enriched with LTV columns."""
    customers = list_customers()
    orders = sheets_client.read_tab("Orders")
    if customers.empty:
        return customers
    if orders.empty or "customer_id" not in orders.columns:
        customers["orders_count"] = 0
        customers["total_spend_vnd"] = 0
        return customers
    valid = orders[
        orders["status"].astype(str).isin(["confirmed", "in_progress", "ready", "delivered"])
    ].copy()
    valid["customer_id"] = pd.to_numeric(valid["customer_id"], errors="coerce")
    valid["total_vnd"] = pd.to_numeric(valid["total_vnd"], errors="coerce").fillna(0)
    grouped = (
        valid.groupby("customer_id")
        .agg(orders_count=("id", "count"), total_spend_vnd=("total_vnd", "sum"))
        .reset_index()
    )
    customers = customers.copy()
    customers["id_int"] = pd.to_numeric(customers["id"], errors="coerce")
    merged = customers.merge(
        grouped, left_on="id_int", right_on="customer_id", how="left"
    )
    merged["orders_count"] = merged["orders_count"].fillna(0).astype(int)
    merged["total_spend_vnd"] = merged["total_spend_vnd"].fillna(0).astype(int)
    return merged.drop(columns=["id_int", "customer_id"], errors="ignore")

"""Menu module — Dish, Recipe, Campaign queries + writes."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

import pandas as pd

from lib import sheets_client
from lib.audit import log_action
from lib.models import Campaign, Dish, Recipe


def list_dishes(active_only: bool = False) -> pd.DataFrame:
    df = sheets_client.read_tab("Dishes")
    if df.empty:
        return df
    if active_only and "is_active" in df.columns:
        return df[df["is_active"].astype(str).str.upper().isin(["TRUE", "1", "YES"])]
    return df


def active_dishes() -> list[Dish]:
    df = list_dishes(active_only=True)
    return [Dish.from_row(r) for _, r in df.iterrows()]


def get_dish(dish_id: int) -> Optional[Dish]:
    df = sheets_client.read_tab("Dishes")
    if df.empty:
        return None
    matches = df[pd.to_numeric(df["id"], errors="coerce") == int(dish_id)]
    if matches.empty:
        return None
    return Dish.from_row(matches.iloc[0])


def upsert_dish(dish: Dish, actor_role: str = "staff") -> int:
    if dish.id:
        sheets_client.update_row("Dishes", dish.id, dish.to_row())
        log_action(actor_role, "dish.update", target_kind="Dish", target_id=dish.id)
        return dish.id
    new_id = sheets_client.append_row("Dishes", dish.to_row())
    log_action(actor_role, "dish.create", target_kind="Dish", target_id=new_id)
    return new_id


def retire_dish(dish_id: int, actor_role: str = "admin") -> bool:
    patch = {
        "is_active": "FALSE",
        "retired_at": datetime.now().isoformat(timespec="seconds"),
    }
    ok = sheets_client.update_row("Dishes", dish_id, patch)
    if ok:
        log_action(actor_role, "dish.retire", target_kind="Dish", target_id=dish_id)
    return ok


def recipe_for(dish_id: int) -> list[Recipe]:
    df = sheets_client.read_tab("Recipes")
    if df.empty or "dish_id" not in df.columns:
        return []
    matches = df[pd.to_numeric(df["dish_id"], errors="coerce") == int(dish_id)]
    return [Recipe.from_row(r) for _, r in matches.iterrows()]


def replace_recipe(dish_id: int, lines: list[Recipe], actor_role: str = "admin") -> int:
    """Delete existing Recipe rows for dish_id, insert new ones."""
    with sheets_client.with_lock("recipes_write", actor_role):
        sheets_client.delete_rows_where("Recipes", {"dish_id": str(dish_id)})
        rows = [{**ln.to_row(), "dish_id": dish_id} for ln in lines]
        n = sheets_client.append_rows("Recipes", rows)
    log_action(
        actor_role,
        "recipe.update",
        target_kind="Dish",
        target_id=dish_id,
        diff={"count_lines_after": n},
    )
    return n


def list_campaigns(active_only: bool = False) -> pd.DataFrame:
    df = sheets_client.read_tab("Campaigns")
    if df.empty:
        return df
    if active_only and "is_active" in df.columns:
        return df[df["is_active"].astype(str).str.upper().isin(["TRUE", "1", "YES"])]
    return df


def active_campaigns(at: Optional[datetime] = None) -> list[Campaign]:
    at = at or datetime.now()
    df = list_campaigns(active_only=True)
    if df.empty:
        return []
    out = []
    for _, row in df.iterrows():
        c = Campaign.from_row(row)
        if c.starts_at and c.starts_at > at:
            continue
        if c.ends_at and c.ends_at < at:
            continue
        out.append(c)
    return out


def upsert_campaign(c: Campaign, actor_role: str = "staff") -> int:
    if c.id:
        sheets_client.update_row("Campaigns", c.id, c.to_row())
        log_action(actor_role, "campaign.update", target_kind="Campaign", target_id=c.id)
        return c.id
    new_id = sheets_client.append_row("Campaigns", c.to_row())
    log_action(actor_role, "campaign.create", target_kind="Campaign", target_id=new_id)
    return new_id

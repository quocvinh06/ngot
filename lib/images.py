"""Topical photo URL helper using LoremFlickr (per visual-content.md).

Deterministic per (entity_name, decisions) — same entity always returns same image.
"""
from __future__ import annotations

import hashlib
from typing import Optional

# Per-entity tag dictionary (drives topical relevance per visual-content.md)
_ENTITY_TAGS: dict[str, str] = {
    "Dish": "cake,pastry,bakery,dessert,vietnam",
    "Ingredient": "ingredient,baking,flour,butter",
    "Customer": "person,smile,portrait,vietnam",
    "Order": "cake,box,gift,delivery",
    "Equipment": "kitchen,oven,bakery,equipment",
    "Campaign": "celebration,bakery,sale,promotion",
    "TelegramMessage": "phone,chat,message",
    "_default": "bakery,cake,pastry,vietnam",
}

# Domain-level fallback tags
_DOMAIN_TAGS = "bakery,cake,pastry,vietnam,dessert"


def _simple_hash(seed: str) -> int:
    h = hashlib.md5(seed.encode("utf-8")).hexdigest()
    return int(h[:8], 16) % 100000


def image_topic_tags(decisions: Optional[dict] = None, entity_name: Optional[str] = None) -> str:
    """Compute topic tags for the photo source."""
    if entity_name and entity_name in _ENTITY_TAGS:
        return _ENTITY_TAGS[entity_name]
    if decisions and isinstance(decisions, dict):
        domains = decisions.get("classifier", {}).get("detected_domains") or decisions.get(
            "detected_domains"
        )
        if isinstance(domains, list) and domains:
            joined = ",".join(d.replace("_", " ").split()[0] for d in domains[:4])
            return joined + "," + _DOMAIN_TAGS
    return _DOMAIN_TAGS


def topical_image_url(
    seed: str,
    w: int = 800,
    h: int = 500,
    decisions: Optional[dict] = None,
    entity_name: Optional[str] = None,
) -> str:
    """Return a LoremFlickr URL deterministic per seed but topical to entity."""
    tags = image_topic_tags(decisions, entity_name)
    lock = _simple_hash(str(seed) or "default")
    return f"https://loremflickr.com/{w}/{h}/{tags}?lock={lock}"


def dish_image_url(name: str, w: int = 600, h: int = 400) -> str:
    return topical_image_url(seed=name, w=w, h=h, entity_name="Dish")


def ingredient_image_url(name: str, w: int = 400, h: int = 300) -> str:
    return topical_image_url(seed=name, w=w, h=h, entity_name="Ingredient")

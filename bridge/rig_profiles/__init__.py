"""
bridge/rig_profiles/__init__.py
Dynamic Plugin Registry for EZHAMShack Transceiver Profiles.
Automatically discovers all BaseRig subclasses (e.g., ft991a, ts2000, ic7300).
"""

import importlib
import logging
import os
import pkgutil
import re
from typing import Dict, List, Type
from .base_rig import BaseRig

logger = logging.getLogger("RigRegistry")

RIG_REGISTRY: Dict[str, Type[BaseRig]] = {}


def _normalize_id(val: str) -> str:
    """Strips hyphens, underscores, and whitespace for resilient profile matching."""
    return re.sub(r"[^a-z0-9]", "", (val or "").strip().lower())


def load_rig_profiles() -> None:
    """Dynamically imports all modules in this package and registers BaseRig subclasses."""
    package_dir = os.path.dirname(__file__)

    for _, module_name, is_pkg in pkgutil.iter_modules([package_dir]):
        if is_pkg or module_name.startswith("base_"):
            continue
        try:
            full_module_name = f"{__name__}.{module_name}"
            importlib.import_module(full_module_name)
        except Exception as e:
            logger.error("Failed loading rig profile '%s': %s", module_name, e)

    # Recursively inspect all loaded subclasses of BaseRig
    def _all_subclasses(cls: Type[BaseRig]):
        for sub in cls.__subclasses__():
            yield sub
            yield from _all_subclasses(sub)

    for cls in _all_subclasses(BaseRig):
        profile_id = getattr(cls, "rig_id", cls.__name__.lower()).strip().lower()
        if profile_id and profile_id not in RIG_REGISTRY:
            RIG_REGISTRY[profile_id] = cls
            logger.info("Registered rig profile: [%s] -> %s", profile_id, cls.__name__)


# Run discovery on import
load_rig_profiles()


def list_rig_profiles() -> List[Dict[str, str]]:
    """Returns metadata for all registered transceiver profiles."""
    return [
        {
            "rig_id": rid,
            "name": getattr(cls, "name", cls.__name__),
            "default_baudrate": str(getattr(cls, "default_baudrate", 9600)),
        }
        for rid, cls in RIG_REGISTRY.items()
    ]


def get_rig_profile(identifier: str) -> BaseRig:
    """
    Instantiates a rig driver by ID (e.g., 'ic7300', 'IC-7300', '7300', 'ft991a', 'ts2000'),
    falling back to FT-991A or the first registered profile.
    """
    clean_id = (identifier or "").strip().lower()
    norm_id = _normalize_id(clean_id)

    # 1. Direct exact match
    if clean_id in RIG_REGISTRY:
        return RIG_REGISTRY[clean_id]()

    # 2. Normalized exact match (e.g., "ic-7300" -> "ic7300")
    if norm_id:
        for reg_id, cls in RIG_REGISTRY.items():
            if _normalize_id(reg_id) == norm_id:
                return cls()

        # 3. Fuzzy substring match (e.g., "7300" -> "ic7300", "991" -> "ft991a")
        for reg_id, cls in RIG_REGISTRY.items():
            norm_reg = _normalize_id(reg_id)
            if norm_id in norm_reg or norm_reg in norm_id:
                return cls()

    # 4. Fallback to default
    default_cls = RIG_REGISTRY.get("ft991a") or next(iter(RIG_REGISTRY.values()))
    logger.warning("Profile '%s' not found. Falling back to %s", identifier, default_cls.__name__)
    return default_cls()
"""
bridge/rig_profiles/__init__.py
Dynamic Plugin Registry for EZShack Transceiver Profiles.
"""

import importlib
import logging
import os
import pkgutil
from typing import Dict, Type
from .base_rig import BaseRig

logger = logging.getLogger("RigRegistry")

RIG_REGISTRY: Dict[str, Type[BaseRig]] = {}

def load_rig_profiles():
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

    # Inspect all loaded subclasses of BaseRig
    for cls in BaseRig.__subclasses__():
        # Derive an identifier from an explicit attribute or the class name lowercase
        profile_id = getattr(cls, "rig_id", cls.__name__.lower())
        RIG_REGISTRY[profile_id] = cls
        logger.info("Registered rig profile: [%s] -> %s", profile_id, cls.__name__)

# Run discovery on import
load_rig_profiles()

def get_rig_profile(identifier: str) -> BaseRig:
    """Instantiates a rig driver by ID, falling back to FT-991A or the first registered profile."""
    clean_id = (identifier or "").strip().lower()
    
    # Direct match
    if clean_id in RIG_REGISTRY:
        return RIG_REGISTRY[clean_id]()
        
    # Fuzzy match (e.g., "991" matches "ft991a", "2000" matches "ts2000")
    for reg_id, cls in RIG_REGISTRY.items():
        if clean_id in reg_id or reg_id in clean_id:
            return cls()

    # Fallback to default
    default_cls = RIG_REGISTRY.get("ft991a") or next(iter(RIG_REGISTRY.values()))
    logger.warning("Profile '%s' not found. Falling back to %s", identifier, default_cls.__name__)
    return default_cls()
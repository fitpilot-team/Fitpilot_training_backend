from __future__ import annotations

from typing import Protocol


LOCAL_LAN_ORIGIN_REGEX = (
    r"https?://(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}"
    r"|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?"
)

DEFAULT_PUBLIC_APP_ORIGINS = [
    "https://fitpilot.fit",
    "https://www.fitpilot.fit",
    "https://pro.fitpilot.fit",
    "https://app.fitpilot.fit",
]


class CorsSettingsLike(Protocol):
    CORS_ALLOWED_ORIGINS: str | None
    FRONTEND_URL: str


def resolve_allowed_origins(settings: CorsSettingsLike) -> list[str]:
    configured_origins = [
        origin.strip().rstrip("/")
        for origin in (settings.CORS_ALLOWED_ORIGINS or "").split(",")
        if origin and origin.strip()
    ]

    frontend_origin = settings.FRONTEND_URL.strip().rstrip("/") if settings.FRONTEND_URL else ""
    if frontend_origin:
        configured_origins.append(frontend_origin)

    configured_origins.extend(DEFAULT_PUBLIC_APP_ORIGINS)
    configured_origins.append("http://localhost:4000")
    configured_origins.append("http://127.0.0.1:4000")

    deduped_origins: list[str] = []
    for origin in configured_origins:
        if origin and origin not in deduped_origins:
            deduped_origins.append(origin)

    return deduped_origins or DEFAULT_PUBLIC_APP_ORIGINS + [
        "http://localhost:3000",
        "http://localhost:4000",
    ]

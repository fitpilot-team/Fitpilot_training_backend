"""
Service for generating anatomical muscle images.
Generated exercise images are uploaded directly to R2; no local exercise-media writes remain.
"""
import os
from typing import Optional

import httpx

from services.exercise_media_storage import StorageError, upload_exercise_media_bytes

MUSCLE_API_URL = os.getenv("MUSCLE_API_URL", "http://muscle-image-api:80")

MUSCLE_GROUP_MAPPING = {
    "chest": {
        "primary": ["chest"],
        "secondary": ["triceps", "shoulders_front"],
        "color": "220,53,69",
    },
    "back": {
        "primary": ["back", "latissimus"],
        "secondary": ["biceps", "shoulders_back"],
        "color": "0,123,255",
    },
    "shoulders": {
        "primary": ["shoulders"],
        "secondary": ["triceps", "chest"],
        "color": "255,193,7",
    },
    "arms": {
        "primary": ["biceps", "triceps", "forearms"],
        "secondary": [],
        "color": "111,66,193",
    },
    "legs": {
        "primary": ["quadriceps", "hamstring", "gluteus", "calfs"],
        "secondary": ["adductors", "abductors"],
        "color": "40,167,69",
    },
    "core": {
        "primary": ["abs", "core"],
        "secondary": ["back_lower"],
        "color": "253,126,20",
    },
    "cardio": {
        "primary": ["all"],
        "secondary": [],
        "color": "232,62,140",
    },
}


def _safe_media_name(value: str) -> str:
    normalized = value.lower().replace(" ", "_").replace("-", "_")
    return "".join(char for char in normalized if char.isalnum() or char == "_") or "exercise"


def _build_generation_request(muscle_group: str, use_multicolor: bool) -> tuple[str, dict]:
    mapping = MUSCLE_GROUP_MAPPING[muscle_group]
    primary_muscles = mapping["primary"]
    secondary_muscles = mapping["secondary"]
    primary_color = mapping["color"]

    if use_multicolor and secondary_muscles:
        params = {
            "primaryMuscleGroups": ",".join(primary_muscles),
            "secondaryMuscleGroups": ",".join(secondary_muscles),
            "primaryColor": primary_color,
            "secondaryColor": "180,180,180",
            "transparentBackground": "0",
        }
        url = f"{MUSCLE_API_URL}/getMulticolorImage"
    else:
        all_muscles = primary_muscles + secondary_muscles
        params = {
            "muscleGroups": ",".join(all_muscles),
            "color": primary_color,
            "transparentBackground": "0",
        }
        url = f"{MUSCLE_API_URL}/getImage"

    return url, params


def _upload_generated_image(exercise_id: str, exercise_name: str, content: bytes, content_type: Optional[str]) -> str:
    file_name = f"{_safe_media_name(exercise_name)}_anatomy.png"
    return upload_exercise_media_bytes(
        exercise_id=exercise_id,
        media_kind="anatomy",
        source_filename=file_name,
        content=content,
        content_type=content_type or "image/png",
    )


async def generate_muscle_image(
    exercise_id: str,
    muscle_group: str,
    exercise_name: str,
    use_multicolor: bool = True,
) -> Optional[str]:
    """
    Generate and upload an anatomy image for a specific exercise.
    Returns the public R2 URL or None if generation fails.
    """
    if muscle_group not in MUSCLE_GROUP_MAPPING:
        print(f"Grupo muscular desconocido: {muscle_group}")
        return None

    url, params = _build_generation_request(muscle_group, use_multicolor)

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, params=params)

        if response.status_code == 200 and response.headers.get("content-type", "").startswith("image/"):
            return _upload_generated_image(
                exercise_id=exercise_id,
                exercise_name=exercise_name,
                content=response.content,
                content_type=response.headers.get("content-type"),
            )

        print(f"Error generando imagen: {response.status_code}")
        return None
    except StorageError:
        raise
    except Exception as exc:
        print(f"Error conectando al API de imágenes: {exc}")
        return None


def generate_muscle_image_sync(
    exercise_id: str,
    muscle_group: str,
    exercise_name: str,
    use_multicolor: bool = True,
) -> Optional[str]:
    """
    Synchronous version used by the API and scripts.
    """
    import requests

    if muscle_group not in MUSCLE_GROUP_MAPPING:
        print(f"Grupo muscular desconocido: {muscle_group}")
        return None

    url, params = _build_generation_request(muscle_group, use_multicolor)

    try:
        response = requests.get(url, params=params, timeout=30)

        if response.status_code == 200 and "image" in response.headers.get("content-type", ""):
            return _upload_generated_image(
                exercise_id=exercise_id,
                exercise_name=exercise_name,
                content=response.content,
                content_type=response.headers.get("content-type"),
            )

        print(f"  [FAIL] Status: {response.status_code}")
        return None
    except StorageError:
        raise
    except Exception as exc:
        print(f"  [ERROR] {str(exc)[:80]}")
        return None


def get_anatomy_image_url(muscle_group: str) -> str:
    """
    Build a generic anatomy image for a muscle group and store it in R2.
    """
    if muscle_group not in MUSCLE_GROUP_MAPPING:
        return ""

    return (
        generate_muscle_image_sync(
            exercise_id=f"group_{_safe_media_name(muscle_group)}",
            muscle_group=muscle_group,
            exercise_name=muscle_group,
            use_multicolor=False,
        )
        or ""
    )

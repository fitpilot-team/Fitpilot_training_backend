"""
Service for fetching exercise movement images from Wger.de API.
Downloaded images are uploaded directly to R2; no local exercise-media writes remain.
"""
from typing import Optional, Dict

import requests

from services.media_storage import StorageError, upload_exercise_media_bytes

# Wger API base URL
WGER_API_URL = "https://wger.de/api/v2"
WGER_BASE_URL = "https://wger.de"


def _safe_media_name(value: str) -> str:
    normalized = value.lower().replace(" ", "_").replace("-", "_")
    return "".join(char for char in normalized if char.isalnum() or char == "_") or "exercise"


def search_wger_exercise(exercise_name: str) -> Optional[Dict]:
    """
    Search for an exercise in Wger.de using the search endpoint.
    Returns the best matching exercise with image info or None if not found.
    """
    try:
        response = requests.get(
            f"{WGER_API_URL}/exercise/search/",
            params={
                "term": exercise_name,
                "language": "en",
            },
            timeout=15,
        )
        response.raise_for_status()
        data = response.json()

        suggestions = data.get("suggestions", [])
        if not suggestions:
            print(f"  [NOT FOUND] No results for '{exercise_name}'")
            return None

        best_match = suggestions[0].get("data", {})
        print(f"  [FOUND] {best_match.get('name')} (id: {best_match.get('id')})")
        return best_match

    except Exception as exc:
        print(f"Error searching Wger exercise: {exc}")
        return None


def download_wger_image(exercise_id: str, image_path: str, exercise_name: str) -> Optional[str]:
    """
    Download an image from Wger and upload it to R2.
    Returns the public R2 URL or None if failed.
    """
    try:
        safe_name = _safe_media_name(exercise_name)

        if image_path.startswith("/"):
            image_url = f"{WGER_BASE_URL}{image_path}"
        else:
            image_url = image_path

        ext = image_path.split(".")[-1].split("?")[0].lower()
        if ext not in ["jpg", "jpeg", "png", "gif", "webp"]:
            ext = "png"

        filename = f"{safe_name}_movement.{ext}"

        print(f"  [DOWNLOADING] {image_url}")
        response = requests.get(image_url, timeout=15)
        response.raise_for_status()

        return upload_exercise_media_bytes(
            exercise_id=exercise_id,
            media_kind="movement",
            source_filename=filename,
            content=response.content,
            content_type=response.headers.get("content-type"),
        )
    except StorageError:
        raise
    except Exception as exc:
        print(f"  [FAIL] Error downloading image: {exc}")
        return None


def fetch_movement_image(exercise_id: str, exercise_name: str) -> Optional[str]:
    """
    Main function to fetch a movement image for an exercise.
    1. Search for the exercise in Wger using search endpoint
    2. Download the image and upload it to R2

    Returns the public R2 URL or None if not found.
    """
    print(f"Searching Wger for: {exercise_name}")

    exercise = search_wger_exercise(exercise_name)
    if not exercise:
        return None

    image_path = exercise.get("image")
    if not image_path:
        print("  [NO IMAGE] Exercise found but no image available")
        return None

    return download_wger_image(exercise_id=exercise_id, image_path=image_path, exercise_name=exercise_name)


def fetch_all_movement_images_sync(exercises: list) -> dict:
    """
    Fetch movement images for multiple exercises.
    Returns dict with exercise name -> image URL mapping.
    """
    results = {}

    for exercise in exercises:
        if isinstance(exercise, dict):
            name = exercise.get("name")
            exercise_id = exercise.get("id")
        else:
            name = getattr(exercise, "name", None)
            exercise_id = getattr(exercise, "id", None)

        if not name or exercise_id is None:
            continue

        image_url = fetch_movement_image(str(exercise_id), name)
        results[name] = image_url

    return results


EXERCISE_NAME_MAPPING = {
    "Barbell Bench Press": "bench press",
    "Barbell Back Squat": "squat",
    "Barbell Deadlift": "deadlift",
    "Pull-ups": "pull up",
    "Push-ups": "push up",
    "Military Press": "shoulder press",
    "Lat Pulldown": "lat pulldown",
    "Cable Row": "seated row",
    "Barbell Row": "bent over row",
    "Dumbbell Lateral Raise": "lateral raise",
    "Barbell Curl": "bicep curl",
    "Tricep Dips": "dips",
    "Leg Press": "leg press",
    "Leg Extension": "leg extension",
    "Leg Curl": "leg curl",
    "Calf Raises": "calf raise",
    "Plank": "plank",
}


def get_mapped_name(exercise_name: str) -> str:
    """Get the Wger-friendly name for an exercise."""
    return EXERCISE_NAME_MAPPING.get(exercise_name, exercise_name)

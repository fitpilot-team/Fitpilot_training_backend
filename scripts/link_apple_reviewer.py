from __future__ import annotations

import logging
import os
import sys

from sqlalchemy import text

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.base import SessionLocal
from models.user import User, UserRole

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

REVIEWER_EMAIL = "appreview@fitpilot.fit"
SERVICE_TYPES = ("NUTRITION", "TRAINING")


def ensure_service_link(db, *, professional_id: int, client_id: int, service_type: str) -> str:
    existing_link = db.execute(
        text(
            """
            SELECT id, status
            FROM public.professional_clients
            WHERE professional_id = :professional_id
              AND client_id = :client_id
              AND service_type = :service_type
            ORDER BY id
            LIMIT 1
            """
        ),
        {
            "professional_id": professional_id,
            "client_id": client_id,
            "service_type": service_type,
        },
    ).mappings().first()

    if existing_link is None:
        db.execute(
            text(
                """
                INSERT INTO public.professional_clients (
                    professional_id,
                    client_id,
                    service_type,
                    status
                )
                VALUES (:professional_id, :client_id, :service_type, 'active')
                """
            ),
            {
                "professional_id": professional_id,
                "client_id": client_id,
                "service_type": service_type,
            },
        )
        return "created"

    if existing_link["status"] != "active":
        db.execute(
            text(
                """
                UPDATE public.professional_clients
                SET status = 'active'
                WHERE id = :link_id
                """
            ),
            {"link_id": existing_link["id"]},
        )
        return "reactivated"

    return "unchanged"


def link_reviewer() -> None:
    db = SessionLocal()
    try:
        reviewer = db.query(User).filter(User.email == REVIEWER_EMAIL).first()
        if reviewer is None:
            logger.error("Reviewer not found: %s", REVIEWER_EMAIL)
            return

        professionals = (
            db.query(User)
            .filter(User.is_active.is_(True), User.role.in_([UserRole.ADMIN, UserRole.TRAINER]))
            .order_by(User.id)
            .all()
        )
        if not professionals:
            logger.warning("No active professionals found to link to Apple Reviewer.")

        for professional in professionals:
            changes = []
            for service_type in SERVICE_TYPES:
                outcome = ensure_service_link(
                    db,
                    professional_id=professional.id,
                    client_id=reviewer.id,
                    service_type=service_type,
                )
                if outcome != "unchanged":
                    changes.append(f"{service_type}:{outcome}")

            if changes:
                logger.info("Updated links for %s -> %s", professional.email, ", ".join(changes))
            else:
                logger.info("Links already active for %s", professional.email)

        db.commit()
        logger.info("Apple Reviewer professional links verified.")
    except Exception:
        db.rollback()
        logger.exception("Failed to link Apple Reviewer")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    link_reviewer()

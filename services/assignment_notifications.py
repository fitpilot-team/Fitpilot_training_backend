import logging
from typing import Literal, Optional

import httpx

from core.config import settings

AssignmentNotificationDomain = Literal["nutrition", "training"]
AssignmentNotificationKind = Literal[
    "direct_create",
    "weekly_day",
    "weekly_range",
    "template_assign",
    "manual_create",
    "ai_create",
]

logger = logging.getLogger(__name__)


def _build_assignment_notification_url() -> str:
    base_url = settings.NUTRITION_API_URL.rstrip("/")
    if not base_url.endswith("/v1"):
        base_url = f"{base_url}/v1"
    return f"{base_url}/users/assignment-notifications"


def _build_assignment_notification_payload(
    *,
    client_id: int,
    domain: AssignmentNotificationDomain,
    entity_id: int,
    entity_name: Optional[str],
    assignment_kind: AssignmentNotificationKind,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> dict:
    payload = {
        "clientId": client_id,
        "domain": domain,
        "entityId": entity_id,
        "entityName": entity_name,
        "assignmentKind": assignment_kind,
    }
    if start_date:
        payload["startDate"] = start_date
    if end_date:
        payload["endDate"] = end_date
    return payload


def _log_assignment_notification_warning(
    *,
    client_id: int | str,
    domain: AssignmentNotificationDomain,
    entity_id: int,
    assignment_kind: AssignmentNotificationKind,
    cause: str,
) -> None:
    logger.warning(
        "assignment_notification.dispatch_failed",
        extra={
            "clientId": client_id,
            "domain": domain,
            "entityId": entity_id,
            "assignmentKind": assignment_kind,
            "cause": cause,
        },
    )


async def send_assignment_notification(
    *,
    authorization: Optional[str],
    client_id: int,
    domain: AssignmentNotificationDomain,
    entity_id: int,
    entity_name: Optional[str],
    assignment_kind: AssignmentNotificationKind,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> bool:
    if not authorization:
        _log_assignment_notification_warning(
            client_id=client_id,
            domain=domain,
            entity_id=entity_id,
            assignment_kind=assignment_kind,
            cause="missing_authorization",
        )
        return False

    payload = _build_assignment_notification_payload(
        client_id=client_id,
        domain=domain,
        entity_id=entity_id,
        entity_name=entity_name,
        assignment_kind=assignment_kind,
        start_date=start_date,
        end_date=end_date,
    )

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(
                _build_assignment_notification_url(),
                json=payload,
                headers={"Authorization": authorization},
            )
            response.raise_for_status()
        return True
    except Exception as exc:
        _log_assignment_notification_warning(
            client_id=client_id,
            domain=domain,
            entity_id=entity_id,
            assignment_kind=assignment_kind,
            cause=str(exc),
        )
        return False


def send_assignment_notification_sync(
    *,
    authorization: Optional[str],
    client_id: int,
    domain: AssignmentNotificationDomain,
    entity_id: int,
    entity_name: Optional[str],
    assignment_kind: AssignmentNotificationKind,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> bool:
    if not authorization:
        _log_assignment_notification_warning(
            client_id=client_id,
            domain=domain,
            entity_id=entity_id,
            assignment_kind=assignment_kind,
            cause="missing_authorization",
        )
        return False

    payload = _build_assignment_notification_payload(
        client_id=client_id,
        domain=domain,
        entity_id=entity_id,
        entity_name=entity_name,
        assignment_kind=assignment_kind,
        start_date=start_date,
        end_date=end_date,
    )

    try:
        with httpx.Client(timeout=5.0) as client:
            response = client.post(
                _build_assignment_notification_url(),
                json=payload,
                headers={"Authorization": authorization},
            )
            response.raise_for_status()
        return True
    except Exception as exc:
        _log_assignment_notification_warning(
            client_id=client_id,
            domain=domain,
            entity_id=entity_id,
            assignment_kind=assignment_kind,
            cause=str(exc),
        )
        return False

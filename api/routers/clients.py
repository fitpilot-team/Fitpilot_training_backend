from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from typing import Optional
from models.base import get_db
from models.mesocycle import Macrocycle
from models.user import User, UserRole
from schemas.client import (
    ClientCreate,
    ClientUpdate,
    ClientResponse,
    ClientListResponse,
    ClientPaletteResult,
)
from core.security import get_password_hash
from core.dependencies import (
    assert_training_professional_access,
    get_current_user,
    get_effective_user_role,
)

router = APIRouter()


def _ensure_training_access(current_user: User) -> None:
    assert_training_professional_access(current_user)


def _normalize_palette_query(q: str) -> str:
    return q.strip()


def _resolve_palette_limit(limit: int) -> int:
    return min(limit, 10)


def _build_client_display_name(client: User) -> str:
    return " ".join(part.strip() for part in [client.name or "", client.lastname or ""] if part and part.strip())


def _build_client_palette_result(client: User) -> ClientPaletteResult:
    return ClientPaletteResult(
        id=str(client.id),
        name=client.name,
        lastname=client.lastname,
        display_name=_build_client_display_name(client),
        email=client.email,
        is_active=bool(client.is_active),
    )


@router.get("/", response_model=ClientListResponse)
def get_clients(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all clients (users with role=client)"""

    _ensure_training_access(current_user)

    query = db.query(User).filter(User.role == UserRole.CLIENT)
    full_name_expr = func.trim(func.concat(User.name, " ", func.coalesce(User.lastname, "")))

    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                full_name_expr.ilike(search_filter),
                User.name.ilike(search_filter),
                User.lastname.ilike(search_filter),
                User.email.ilike(search_filter),
            )
        )

    total = query.count()
    clients = query.order_by(User.name.asc(), User.lastname.asc()).offset(skip).limit(limit).all()

    return ClientListResponse(clients=clients, total=total)


@router.get("/palette-search", response_model=list[ClientPaletteResult])
def palette_search_clients(
    q: str = Query(""),
    limit: int = Query(8, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    normalized_query = _normalize_palette_query(q)
    if len(normalized_query) < 2:
        return []

    effective_role = get_effective_user_role(current_user)
    if effective_role == "client":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Clients are not allowed to access professional palette search",
        )

    _ensure_training_access(current_user)

    search_filter = f"%{normalized_query}%"
    full_name_expr = func.trim(func.concat(User.name, " ", func.coalesce(User.lastname, "")))
    query = db.query(User).filter(User.role == UserRole.CLIENT)

    if effective_role == "trainer":
        # Phase 4 heuristic: training repo only persists trainer-client ownership
        # through macrocycles, so palette client scope is derived from those links.
        query = query.join(Macrocycle, Macrocycle.client_id == User.id).filter(
            Macrocycle.trainer_id == current_user.id
        )

    clients = (
        query.filter(
            or_(
                full_name_expr.ilike(search_filter),
                User.name.ilike(search_filter),
                User.lastname.ilike(search_filter),
                User.email.ilike(search_filter),
            )
        )
        .distinct()
        .order_by(User.name.asc(), User.lastname.asc())
        .limit(_resolve_palette_limit(limit))
        .all()
    )

    return [_build_client_palette_result(client) for client in clients]


@router.post("/", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
def create_client(
    client_data: ClientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new client"""

    _ensure_training_access(current_user)

    # Check if email already exists
    existing_user = db.query(User).filter(User.email == client_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Create new client (user with role=client)
    hashed_password = get_password_hash(client_data.password)
    new_client = User(
        email=client_data.email,
        full_name=client_data.full_name,
        hashed_password=hashed_password,
        role=UserRole.CLIENT,
        is_active=True,
        is_verified=False
    )

    db.add(new_client)
    db.commit()
    db.refresh(new_client)

    return new_client


@router.get("/{client_id}", response_model=ClientResponse)
def get_client(
    client_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific client by ID"""

    _ensure_training_access(current_user)

    client = db.query(User).filter(
        User.id == client_id,
        User.role == UserRole.CLIENT
    ).first()

    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )

    return client


@router.put("/{client_id}", response_model=ClientResponse)
def update_client(
    client_id: str,
    client_data: ClientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a client's information"""

    _ensure_training_access(current_user)

    client = db.query(User).filter(
        User.id == client_id,
        User.role == UserRole.CLIENT
    ).first()

    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )

    # Update fields
    if client_data.full_name is not None:
        client.full_name = client_data.full_name
    if client_data.is_active is not None:
        client.is_active = client_data.is_active

    db.commit()
    db.refresh(client)

    return client


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client(
    client_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a client"""

    _ensure_training_access(current_user)

    client = db.query(User).filter(
        User.id == client_id,
        User.role == UserRole.CLIENT
    ).first()

    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )

    db.delete(client)
    db.commit()

    return None

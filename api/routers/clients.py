from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from typing import Optional
from models.base import get_db
from models.user import User, UserRole
from schemas.client import ClientCreate, ClientUpdate, ClientResponse, ClientListResponse
from core.security import get_password_hash
from core.dependencies import assert_training_professional_access, get_current_user

router = APIRouter()


def _ensure_training_access(current_user: User) -> None:
    assert_training_professional_access(current_user)


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

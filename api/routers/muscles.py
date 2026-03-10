"""
API router for Muscle endpoints.
Provides read-only access to the muscle catalog.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from models import Muscle, get_db
from schemas.muscle import MuscleListResponse, MuscleResponse

router = APIRouter()


@router.get("", response_model=MuscleListResponse)
def list_muscles(
    db: Session = Depends(get_db),
    category: Optional[str] = Query(None, description="Filter by muscle category (chest, back, shoulders, arms, legs, core)"),
    body_region: Optional[str] = Query(None, description="Filter by body region (upper_body, lower_body, core)"),
):
    query = db.query(Muscle).order_by(Muscle.sort_order, Muscle.id)

    if category:
        query = query.filter(Muscle.muscle_category == category)

    if body_region:
        query = query.filter(Muscle.body_region == body_region)

    muscles = query.all()
    return MuscleListResponse(total=len(muscles), muscles=muscles)


@router.get("/categories/list", response_model=list[str])
def list_categories(db: Session = Depends(get_db)):
    categories = db.query(Muscle.muscle_category).distinct().all()
    return [c[0] for c in categories if c[0]]


@router.get("/regions/list", response_model=list[str])
def list_body_regions(db: Session = Depends(get_db)):
    regions = db.query(Muscle.body_region).distinct().all()
    return [r[0] for r in regions if r[0]]


@router.get("/by-name/{muscle_name}", response_model=MuscleResponse)
def get_muscle_by_name(
    muscle_name: str,
    db: Session = Depends(get_db),
):
    muscle = db.query(Muscle).filter(Muscle.name == muscle_name).first()
    if not muscle:
        raise HTTPException(status_code=404, detail="MÃºsculo no encontrado")
    return muscle


@router.get("/{muscle_id}", response_model=MuscleResponse)
def get_muscle(
    muscle_id: int,
    db: Session = Depends(get_db),
):
    muscle = db.query(Muscle).filter(Muscle.id == muscle_id).first()
    if not muscle:
        raise HTTPException(status_code=404, detail="MÃºsculo no encontrado")
    return muscle

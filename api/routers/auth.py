from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from core.dependencies import get_current_user
from core.security import get_password_hash, verify_password
from models.base import get_db
from models.user import User, UserRole
from schemas.auth import LoginRequest, RegisterRequest, Token
from schemas.user import PasswordChange, UserResponse, UserUpdate
from services.media_storage import StorageError, delete_managed_media, upload_profile_image

router = APIRouter()

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_PROFILE_IMAGE_SIZE_MB = 2
MAX_PROFILE_IMAGE_SIZE_BYTES = MAX_PROFILE_IMAGE_SIZE_MB * 1024 * 1024


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_data: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new user"""
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        email=user_data.email,
        full_name=user_data.full_name,
        hashed_password=hashed_password,
        role=UserRole.CLIENT,
        is_active=True,
        is_verified=False,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


@router.post("/login", response_model=Token)
def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    """
    Deprecated local login endpoint.
    Training API now only accepts Nutrition-issued tokens.
    """
    del credentials, db
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="Training local login is deprecated. Authenticate via Nutrition /v1/auth/login and reuse that Bearer token.",
    )


@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information"""
    return current_user


@router.patch("/me", response_model=UserResponse)
def update_current_user(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update current user information"""
    update_data = user_update.model_dump(exclude_unset=True)

    if "password" in update_data:
        update_data["hashed_password"] = get_password_hash(update_data.pop("password"))
    update_data.pop("preferred_language", None)

    for field, value in update_data.items():
        setattr(current_user, field, value)

    db.commit()
    db.refresh(current_user)

    return current_user


@router.post("/change-password")
def change_password(
    password_data: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Cambiar contraseña del usuario actual.
    Requiere la contraseña actual para validación.
    """
    if not verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Contraseña actual incorrecta",
        )

    current_user.hashed_password = get_password_hash(password_data.new_password)
    db.commit()

    return {"message": "Contraseña actualizada exitosamente"}


@router.post("/me/upload-photo", response_model=UserResponse)
async def upload_profile_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Subir foto de perfil del usuario actual.
    Formatos soportados: JPG, JPEG, PNG, WEBP
    Tamaño máximo: 2MB
    """
    file_ext = Path(file.filename or "").suffix.lower()
    if file_ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tipo de archivo no permitido. Tipos permitidos: {', '.join(sorted(ALLOWED_IMAGE_EXTENSIONS))}",
        )

    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)

    if file_size > MAX_PROFILE_IMAGE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"El archivo ({file_size / 1024 / 1024:.2f}MB) excede el tamaño máximo ({MAX_PROFILE_IMAGE_SIZE_MB}MB)",
        )

    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo está vacío",
        )

    try:
        next_profile_image_url = upload_profile_image(str(current_user.id), file)
    except StorageError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"No se pudo subir la foto de perfil: {str(exc)}",
        ) from exc

    if current_user.profile_image_url and current_user.profile_image_url != next_profile_image_url:
        try:
            delete_managed_media(current_user.profile_image_url)
        except StorageError:
            pass

    current_user.profile_image_url = next_profile_image_url
    db.commit()
    db.refresh(current_user)

    return current_user


@router.delete("/me/photo", response_model=UserResponse)
def delete_profile_photo(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Eliminar foto de perfil del usuario actual.
    """
    if not current_user.profile_image_url:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No hay foto de perfil para eliminar",
        )

    try:
        delete_managed_media(current_user.profile_image_url)
    except StorageError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"No se pudo eliminar la foto de perfil en storage: {str(exc)}",
        ) from exc

    current_user.profile_image_url = None
    db.commit()
    db.refresh(current_user)

    return current_user

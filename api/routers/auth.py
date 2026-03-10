from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from pathlib import Path
import uuid
import shutil

from models.base import get_db
from models.user import User, UserRole
from schemas.auth import LoginRequest, RegisterRequest, Token
from schemas.user import UserResponse, UserUpdate, PasswordChange
from core.security import verify_password, get_password_hash
from core.dependencies import get_current_user

router = APIRouter()

# Configuración para upload de fotos de perfil
PROFILE_UPLOAD_DIR = Path(__file__).parent.parent.parent / "static" / "profiles"
PROFILE_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_PROFILE_IMAGE_SIZE_MB = 2
MAX_PROFILE_IMAGE_SIZE_BYTES = MAX_PROFILE_IMAGE_SIZE_MB * 1024 * 1024


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_data: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new user"""

    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Create new user
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        email=user_data.email,
        full_name=user_data.full_name,
        hashed_password=hashed_password,
        role=UserRole.CLIENT,  # Default role
        is_active=True,
        is_verified=False
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
    db: Session = Depends(get_db)
):
    """Update current user information"""
    update_data = user_update.model_dump(exclude_unset=True)

    # Handle password separately if provided
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
    db: Session = Depends(get_db)
):
    """
    Cambiar contraseña del usuario actual.
    Requiere la contraseña actual para validación.
    """
    # Verificar contraseña actual
    if not verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Contraseña actual incorrecta"
        )

    # Actualizar contraseña
    current_user.hashed_password = get_password_hash(password_data.new_password)
    db.commit()

    return {"message": "Contraseña actualizada exitosamente"}


@router.post("/me/upload-photo", response_model=UserResponse)
async def upload_profile_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Subir foto de perfil del usuario actual.
    Formatos soportados: JPG, JPEG, PNG, WEBP
    Tamaño máximo: 2MB
    """
    # Validar extensión
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tipo de archivo no permitido. Tipos permitidos: {', '.join(ALLOWED_IMAGE_EXTENSIONS)}"
        )

    # Validar tamaño
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)

    if file_size > MAX_PROFILE_IMAGE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"El archivo ({file_size / 1024 / 1024:.2f}MB) excede el tamaño máximo ({MAX_PROFILE_IMAGE_SIZE_MB}MB)"
        )

    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo está vacío"
        )

    # Generar nombre único
    unique_filename = f"{current_user.id}_{uuid.uuid4().hex[:8]}{file_ext}"
    file_path = PROFILE_UPLOAD_DIR / unique_filename

    # Eliminar foto anterior si existe
    if current_user.profile_image_url:
        old_filename = current_user.profile_image_url.split("/")[-1]
        old_file_path = PROFILE_UPLOAD_DIR / old_filename
        if old_file_path.exists():
            old_file_path.unlink()

    # Guardar archivo
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Actualizar URL en base de datos
    current_user.profile_image_url = f"/static/profiles/{unique_filename}"
    db.commit()
    db.refresh(current_user)

    return current_user


@router.delete("/me/photo", response_model=UserResponse)
def delete_profile_photo(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Eliminar foto de perfil del usuario actual.
    """
    if not current_user.profile_image_url:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No hay foto de perfil para eliminar"
        )

    # Eliminar archivo si existe
    filename = current_user.profile_image_url.split("/")[-1]
    file_path = PROFILE_UPLOAD_DIR / filename
    if file_path.exists():
        file_path.unlink()

    # Actualizar base de datos
    current_user.profile_image_url = None
    db.commit()
    db.refresh(current_user)

    return current_user

from pydantic import BaseModel, ConfigDict, EmailStr
from typing import Optional
from datetime import datetime


class ClientCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str


class ClientUpdate(BaseModel):
    full_name: Optional[str] = None
    is_active: Optional[bool] = None


class ClientResponse(BaseModel):
    id: str
    email: str
    full_name: str
    is_active: bool
    is_verified: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ClientListResponse(BaseModel):
    clients: list[ClientResponse]
    total: int


class ClientPaletteResult(BaseModel):
    model_config = ConfigDict(coerce_numbers_to_str=True)

    id: str
    name: str
    lastname: Optional[str] = None
    display_name: str
    email: Optional[str] = None
    is_active: bool

from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import date, datetime


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
    date_of_birth: date | None = None
    is_active: bool
    is_verified: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ClientListResponse(BaseModel):
    clients: list[ClientResponse]
    total: int

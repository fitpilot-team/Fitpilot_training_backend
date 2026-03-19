import asyncio
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
import sys
import types

from fastapi import FastAPI
import httpx


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

if "redis" not in sys.modules:
    redis_module = types.ModuleType("redis")

    class DummyRedis:
        @staticmethod
        def from_url(*args, **kwargs):
            return None

    redis_module.Redis = DummyRedis
    sys.modules["redis"] = redis_module

if "redis.exceptions" not in sys.modules:
    redis_exceptions = types.ModuleType("redis.exceptions")

    class RedisError(Exception):
        pass

    redis_exceptions.RedisError = RedisError
    sys.modules["redis.exceptions"] = redis_exceptions

from api.routers import clients as clients_router  # noqa: E402
from api.routers import exercises as exercises_router  # noqa: E402
from api.routers import mesocycles as mesocycles_router  # noqa: E402
from core.dependencies import get_current_user  # noqa: E402
from models.base import get_db  # noqa: E402
from models.exercise import Exercise, ExerciseClass  # noqa: E402
from models.mesocycle import Macrocycle, MesocycleStatus  # noqa: E402
from models.user import User  # noqa: E402


class FakeQuery:
    def __init__(self, result):
        self.result = result
        self.limit_value = None
        self.join_calls = []
        self.outerjoin_calls = []
        self.options_calls = []

    def join(self, *args, **kwargs):
        self.join_calls.append((args, kwargs))
        return self

    def outerjoin(self, *args, **kwargs):
        self.outerjoin_calls.append((args, kwargs))
        return self

    def options(self, *args, **kwargs):
        self.options_calls.append((args, kwargs))
        return self

    def filter(self, *args, **kwargs):
        return self

    def distinct(self):
        return self

    def order_by(self, *args, **kwargs):
        return self

    def offset(self, *args, **kwargs):
        return self

    def limit(self, value):
        self.limit_value = value
        return self

    def count(self):
        if isinstance(self.result, list):
            return len(self.result)
        return 0 if self.result is None else 1

    def first(self):
        if isinstance(self.result, list):
            return self.result[0] if self.result else None
        return self.result

    def all(self):
        if isinstance(self.result, list):
            return self.result
        if self.result is None:
            return []
        return [self.result]


class FakeSession:
    def __init__(self, mapping):
        self.mapping = mapping
        self.last_queries = {}

    def query(self, model):
        query = FakeQuery(self.mapping.get(model, []))
        self.last_queries[model] = query
        return query


def _build_app(router_module, prefix: str, session: FakeSession, current_user):
    def override_db():
        yield session

    app = FastAPI()
    app.include_router(router_module.router, prefix=prefix)
    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = lambda: current_user
    return app


def _request(app: FastAPI, method: str, path: str):
    async def do_request():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            return await client.request(method, path)

    return asyncio.run(do_request())


def _make_client(client_id: int, name: str, lastname: str | None, email: str | None, is_active: bool = True):
    return SimpleNamespace(
        id=client_id,
        name=name,
        lastname=lastname,
        email=email,
        is_active=is_active,
    )


def _make_exercise(
    exercise_id: int,
    *,
    name_en: str,
    name_es: str | None,
    exercise_class,
    difficulty_level: str | None,
    primary_muscle_names: list[str],
):
    return SimpleNamespace(
        id=exercise_id,
        name_en=name_en,
        name_es=name_es,
        exercise_class=exercise_class,
        difficulty_level=difficulty_level,
        primary_muscle_names=primary_muscle_names,
    )


def _make_macrocycle(
    macrocycle_id: int,
    *,
    name: str,
    objective: str,
    status,
    client_id: int | None,
    client=None,
    created_at: datetime | None = None,
    updated_at: datetime | None = None,
):
    return SimpleNamespace(
        id=macrocycle_id,
        name=name,
        objective=objective,
        status=status,
        client_id=client_id,
        client=client,
        created_at=created_at,
        updated_at=updated_at,
    )


def test_clients_palette_short_query_returns_empty_list(monkeypatch) -> None:
    session = FakeSession({User: [_make_client(1, "Ana", "Lopez", "ana@example.com")]})
    current_user = SimpleNamespace(id=9, role="client", is_active=True)
    app = _build_app(clients_router, "/api/clients", session, current_user)

    monkeypatch.setattr(clients_router, "get_effective_user_role", lambda user: "client")

    try:
        response = _request(app, "GET", "/api/clients/palette-search?q=a")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == []
    assert User not in session.last_queries


def test_clients_palette_forbids_clients_for_non_short_query(monkeypatch) -> None:
    session = FakeSession({User: []})
    current_user = SimpleNamespace(id=9, role="client", is_active=True)
    app = _build_app(clients_router, "/api/clients", session, current_user)

    monkeypatch.setattr(clients_router, "get_effective_user_role", lambda user: "client")

    try:
        response = _request(app, "GET", "/api/clients/palette-search?q=ana")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 403


def test_clients_palette_trainer_uses_macrocycle_link_and_caps_limit(monkeypatch) -> None:
    session = FakeSession(
        {
            User: [
                _make_client(11, "Ana", "Lopez", "ana@example.com"),
                _make_client(12, "Luis", None, "luis@example.com", is_active=False),
            ]
        }
    )
    current_user = SimpleNamespace(id=5, role="trainer", is_active=True)
    app = _build_app(clients_router, "/api/clients", session, current_user)

    monkeypatch.setattr(clients_router, "get_effective_user_role", lambda user: "trainer")
    monkeypatch.setattr(
        clients_router,
        "assert_training_professional_access",
        lambda user: SimpleNamespace(effective_role="trainer"),
    )

    try:
        response = _request(app, "GET", "/api/clients/palette-search?q=an&limit=50")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload == [
        {
            "id": "11",
            "name": "Ana",
            "lastname": "Lopez",
            "display_name": "Ana Lopez",
            "email": "ana@example.com",
            "is_active": True,
        },
        {
            "id": "12",
            "name": "Luis",
            "lastname": None,
            "display_name": "Luis",
            "email": "luis@example.com",
            "is_active": False,
        },
    ]
    assert session.last_queries[User].join_calls
    assert session.last_queries[User].limit_value == 10


def test_clients_palette_admin_uses_default_limit_and_lightweight_shape(monkeypatch) -> None:
    session = FakeSession({User: [_make_client(21, "Mario", "Perez", "mario@example.com")]})
    current_user = SimpleNamespace(id=1, role="admin", is_active=True)
    app = _build_app(clients_router, "/api/clients", session, current_user)

    monkeypatch.setattr(clients_router, "get_effective_user_role", lambda user: "admin")
    monkeypatch.setattr(
        clients_router,
        "assert_training_professional_access",
        lambda user: SimpleNamespace(effective_role="admin"),
    )

    try:
        response = _request(app, "GET", "/api/clients/palette-search?q=ma")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert session.last_queries[User].limit_value == 8
    payload = response.json()
    assert payload[0]["id"] == "21"
    assert "full_name" not in payload[0]
    assert "created_at" not in payload[0]


def test_exercises_palette_short_query_returns_empty_list(monkeypatch) -> None:
    session = FakeSession(
        {
            Exercise: [
                _make_exercise(
                    1,
                    name_en="Press",
                    name_es="Press",
                    exercise_class=ExerciseClass.STRENGTH,
                    difficulty_level="beginner",
                    primary_muscle_names=["chest"],
                )
            ]
        }
    )
    current_user = SimpleNamespace(id=9, role="client", is_active=True)
    app = _build_app(exercises_router, "/api/exercises", session, current_user)

    monkeypatch.setattr(exercises_router, "get_effective_user_role", lambda user: "client")

    try:
        response = _request(app, "GET", "/api/exercises/palette-search?q=p")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == []
    assert Exercise not in session.last_queries


def test_exercises_palette_forbids_clients_for_non_short_query(monkeypatch) -> None:
    session = FakeSession({Exercise: []})
    current_user = SimpleNamespace(id=9, role="client", is_active=True)
    app = _build_app(exercises_router, "/api/exercises", session, current_user)

    monkeypatch.setattr(exercises_router, "get_effective_user_role", lambda user: "client")

    try:
        response = _request(app, "GET", "/api/exercises/palette-search?q=press")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 403


def test_exercises_palette_prefers_spanish_name_and_caps_limit(monkeypatch) -> None:
    session = FakeSession(
        {
            Exercise: [
                _make_exercise(
                    31,
                    name_en="Bench Press",
                    name_es="Press de banca",
                    exercise_class=ExerciseClass.STRENGTH,
                    difficulty_level="intermediate",
                    primary_muscle_names=["chest", "triceps"],
                ),
                _make_exercise(
                    32,
                    name_en="Goblet Squat",
                    name_es=None,
                    exercise_class=ExerciseClass.STRENGTH,
                    difficulty_level=None,
                    primary_muscle_names=["quadriceps"],
                ),
            ]
        }
    )
    current_user = SimpleNamespace(id=5, role="trainer", is_active=True)
    app = _build_app(exercises_router, "/api/exercises", session, current_user)

    monkeypatch.setattr(exercises_router, "get_effective_user_role", lambda user: "trainer")
    monkeypatch.setattr(
        exercises_router,
        "assert_training_professional_access",
        lambda user: SimpleNamespace(effective_role="trainer"),
    )

    try:
        response = _request(app, "GET", "/api/exercises/palette-search?q=pr&limit=100")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert session.last_queries[Exercise].limit_value == 10
    payload = response.json()
    assert payload[0] == {
        "id": "31",
        "name_en": "Bench Press",
        "name_es": "Press de banca",
        "display_name": "Press de banca",
        "exercise_class": "strength",
        "difficulty_level": "intermediate",
        "primary_muscle_names": ["chest", "triceps"],
    }
    assert payload[1]["id"] == "32"
    assert payload[1]["display_name"] == "Goblet Squat"
    assert "description_en" not in payload[0]


def test_mesocycles_palette_short_query_returns_empty_list(monkeypatch) -> None:
    session = FakeSession({Macrocycle: []})
    current_user = SimpleNamespace(id=9, role="client", is_active=True)
    app = _build_app(mesocycles_router, "/api/mesocycles", session, current_user)

    monkeypatch.setattr(mesocycles_router, "get_effective_user_role", lambda user: "client")

    try:
        response = _request(app, "GET", "/api/mesocycles/palette-search?q=h")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == []
    assert Macrocycle not in session.last_queries


def test_mesocycles_palette_forbids_clients_for_non_short_query(monkeypatch) -> None:
    session = FakeSession({Macrocycle: []})
    current_user = SimpleNamespace(id=9, role="client", is_active=True)
    app = _build_app(mesocycles_router, "/api/mesocycles", session, current_user)

    monkeypatch.setattr(mesocycles_router, "get_effective_user_role", lambda user: "client")

    try:
        response = _request(app, "GET", "/api/mesocycles/palette-search?q=hip")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 403


def test_mesocycles_palette_trainer_returns_string_and_null_client_ids(monkeypatch) -> None:
    client = SimpleNamespace(id=70, name="Ana", lastname="Lopez")
    session = FakeSession(
        {
            Macrocycle: [
                _make_macrocycle(
                    41,
                    name="Hipertrofia Base",
                    objective="hypertrophy",
                    status=MesocycleStatus.DRAFT,
                    client_id=70,
                    client=client,
                    created_at=datetime(2026, 3, 10, 12, 0, 0),
                    updated_at=datetime(2026, 3, 11, 9, 30, 0),
                ),
                _make_macrocycle(
                    42,
                    name="Template Fuerza",
                    objective="strength",
                    status=MesocycleStatus.ACTIVE,
                    client_id=None,
                    client=None,
                ),
            ]
        }
    )
    current_user = SimpleNamespace(id=5, role="trainer", is_active=True)
    app = _build_app(mesocycles_router, "/api/mesocycles", session, current_user)

    monkeypatch.setattr(mesocycles_router, "get_effective_user_role", lambda user: "trainer")
    monkeypatch.setattr(
        mesocycles_router,
        "assert_training_professional_access",
        lambda user: SimpleNamespace(effective_role="trainer"),
    )

    try:
        response = _request(app, "GET", "/api/mesocycles/palette-search?q=hip&limit=20")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert session.last_queries[Macrocycle].outerjoin_calls
    assert session.last_queries[Macrocycle].limit_value == 10
    payload = response.json()
    assert payload[0]["id"] == "41"
    assert payload[0]["title"] == "Hipertrofia Base"
    assert payload[0]["client_id"] == "70"
    assert payload[0]["client_name"] == "Ana Lopez"
    assert payload[0]["status"] == "draft"
    assert payload[1]["id"] == "42"
    assert payload[1]["client_id"] is None
    assert payload[1]["client_name"] is None
    assert "mesocycles" not in payload[0]


def test_mesocycles_palette_admin_uses_default_limit(monkeypatch) -> None:
    session = FakeSession(
        {
            Macrocycle: [
                _make_macrocycle(
                    51,
                    name="Programa General",
                    objective="general_fitness",
                    status=MesocycleStatus.ACTIVE,
                    client_id=None,
                )
            ]
        }
    )
    current_user = SimpleNamespace(id=1, role="admin", is_active=True)
    app = _build_app(mesocycles_router, "/api/mesocycles", session, current_user)

    monkeypatch.setattr(mesocycles_router, "get_effective_user_role", lambda user: "admin")
    monkeypatch.setattr(
        mesocycles_router,
        "assert_training_professional_access",
        lambda user: SimpleNamespace(effective_role="admin"),
    )

    try:
        response = _request(app, "GET", "/api/mesocycles/palette-search?q=pr")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert session.last_queries[Macrocycle].limit_value == 8

from pathlib import Path
import sys

import pytest


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from core.database_url import validate_remote_database_url  # noqa: E402


def test_validate_remote_database_url_accepts_remote_supabase_dsn() -> None:
    value = "postgresql://user:password@aws-1-us-east-1.pooler.supabase.com:5432/fitpilot?sslmode=require"

    assert validate_remote_database_url(value) == value


@pytest.mark.parametrize("host", ["localhost", "127.0.0.1", "[::1]", "postgres", "db", "host.docker.internal"])
def test_validate_remote_database_url_rejects_local_hosts(host: str) -> None:
    value = f"postgresql://user:password@{host}:5432/fitpilot"

    with pytest.raises(ValueError, match="not allowed"):
        validate_remote_database_url(value)

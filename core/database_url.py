from urllib.parse import urlparse


LOCAL_DATABASE_HOSTS = {
    "",
    "localhost",
    "127.0.0.1",
    "::1",
    "0.0.0.0",
    "postgres",
    "postgresql",
    "db",
    "database",
    "host.docker.internal",
    "fitpilot_postgres",
    "fitpilot-postgres",
}


def validate_remote_database_url(value: str) -> str:
    database_url = (value or "").strip()
    if not database_url:
        raise ValueError(
            "DATABASE_URL is required and must point to a remote PostgreSQL instance.",
        )

    parsed = urlparse(database_url)
    hostname = (parsed.hostname or "").strip().lower()
    if not hostname:
        raise ValueError(
            "DATABASE_URL must be a valid PostgreSQL connection string with a remote host.",
        )

    if hostname in LOCAL_DATABASE_HOSTS:
        raise ValueError(
            f'DATABASE_URL host "{hostname}" is not allowed. '
            "FitPilot uses remote PostgreSQL databases in development and production.",
        )

    return database_url

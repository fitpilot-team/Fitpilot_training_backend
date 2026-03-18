import os


os.environ.setdefault(
    "DATABASE_URL",
    "postgresql://user:password@remote-db.example.com:5432/fitpilot?sslmode=require",
)

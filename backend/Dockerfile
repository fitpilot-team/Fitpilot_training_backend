FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create static video directory with proper permissions
RUN mkdir -p /app/static/videos && \
    chmod -R 777 /app/static/videos

# Expose port
EXPOSE 8000

# Run the application
CMD ["sh", "-c", "if [ \"$DEPLOY_ENV\" = \"production\" ]; then exec uvicorn api.main:app --host 0.0.0.0 --port 8000; else exec uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload; fi"]

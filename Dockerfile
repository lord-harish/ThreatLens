# Stage 1: Build React Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install
COPY . .
RUN npm run build

# Stage 2: Python Backend
FROM python:3.10-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create a non-root user (UID 1000) for Hugging Face Spaces compatibility
RUN useradd -m -u 1000 user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

WORKDIR /app

# Copy application files and give ownership to user 1000
COPY --chown=user:user backend/ ./backend/
COPY --chown=user:user --from=frontend-builder /app/dist ./dist

# Create uploads and chroma directories with proper permissions
RUN mkdir -p /app/backend/uploads /app/backend/chroma && chown -R user:user /app

USER user

# Hugging Face Spaces expects port 7860
ENV PORT=7860
EXPOSE 7860

CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT}"]

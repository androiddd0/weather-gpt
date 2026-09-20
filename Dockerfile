# Build the React frontend
FROM node:20-alpine AS frontend
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Python backend that serves the built SPA + APIs
FROM python:3.11-slim
WORKDIR /srv/weathergpt
ENV PYTHONUNBUFFERED=1
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY --from=frontend /app/dist ./frontend/dist
EXPOSE 8000
CMD [ "sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}" ]
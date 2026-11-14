# Caspian Match Simulator — single-container production image: builds the React app and serves it with the API from one URL.
FROM node:22-alpine AS web
WORKDIR /app
COPY shared ./shared
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci --no-audit --no-fund
COPY frontend ./frontend
RUN cd frontend && npm run build

FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    DJANGO_DEBUG=0 AZPFL_DATA_DIR=/data PORT=8000
WORKDIR /app
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt "psycopg[binary]>=3.2"
COPY backend ./backend
COPY shared ./shared
COPY --from=web /app/frontend/dist ./frontend/dist
COPY deploy/start.sh /start.sh
RUN chmod +x /start.sh && mkdir -p /data
VOLUME ["/data"]
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD python -c "import urllib.request,os;urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\",\"8000\")}/api/health/')"
CMD ["/start.sh"]

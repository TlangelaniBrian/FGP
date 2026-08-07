FROM python:3.12-slim

# WeasyPrint renders through Pango/HarfBuzz, which are native libraries the slim
# image does not carry. Without them `import weasyprint` raises OSError and form
# generation silently degrades to the plain-text fallback PDF.
RUN apt-get update && apt-get install --no-install-recommends -y \
      libpango-1.0-0 \
      libpangoft2-1.0-0 \
      libharfbuzz0b \
      libffi8 \
      shared-mime-info \
      fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Install dependencies first (layer cache)
COPY pyproject.toml uv.lock ./
RUN uv sync --no-dev --frozen

# Copy source
COPY . .

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

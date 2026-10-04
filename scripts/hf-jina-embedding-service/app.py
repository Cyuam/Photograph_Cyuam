import os
import tempfile
from typing import Any
from urllib.error import URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

import numpy as np
import torch
from fastapi import FastAPI, Header, HTTPException
from PIL import Image
from pydantic import BaseModel
from transformers import AutoModel, AutoProcessor


MODEL_ID = os.environ.get("MODEL_ID", "jinaai/jina-embeddings-v5-omni-small")
MODEL_NAME = os.environ.get("MODEL_NAME", "jina-embeddings-v5-omni-small")
DIMENSIONS = int(os.environ.get("EMBEDDING_DIMENSIONS", "1024"))
SERVICE_API_KEY = os.environ.get("EMBEDDING_API_KEY")
DOWNLOAD_TIMEOUT_SECONDS = int(os.environ.get("DOWNLOAD_TIMEOUT_SECONDS", "30"))
DOWNLOAD_USER_AGENT = os.environ.get(
    "DOWNLOAD_USER_AGENT",
    "Mozilla/5.0 (compatible; JinaEmbeddingBackfill/1.0)",
)
MAX_IMAGE_SIDE = int(os.environ.get("MAX_IMAGE_SIDE", "1024"))

app = FastAPI(title="Jina v5 Omni Embedding Service")

device = "cuda" if torch.cuda.is_available() else "cpu"
print(
    f"Loading {MODEL_ID} on {device} with dimensions={DIMENSIONS}",
    flush=True,
)
model = AutoModel.from_pretrained(
    MODEL_ID,
    trust_remote_code=True,
    default_task="retrieval",
).eval()
model.to(device)
processor = AutoProcessor.from_pretrained(MODEL_ID, trust_remote_code=True)
print("Model loaded; API is starting", flush=True)


class ImageEmbeddingRequest(BaseModel):
    imageUrl: str
    text: str | None = None
    picture: dict[str, Any] | None = None


class ImageBatchEmbeddingRequest(BaseModel):
    items: list[ImageEmbeddingRequest]


class TextEmbeddingRequest(BaseModel):
    text: str
    task: str | None = "query"


def check_auth(authorization: str | None) -> None:
    if not SERVICE_API_KEY:
        return
    if authorization != f"Bearer {SERVICE_API_KEY}":
        raise HTTPException(status_code=401, detail="Invalid embedding service token")


def normalize(values: np.ndarray) -> list[float]:
    vector = np.asarray(values, dtype=np.float32)
    if vector.ndim != 1:
        vector = vector.reshape(-1)
    if vector.shape[0] != DIMENSIONS:
        raise HTTPException(
            status_code=500,
            detail=f"Expected {DIMENSIONS} dimensions, got {vector.shape[0]}",
        )
    norm = np.linalg.norm(vector)
    if not np.isfinite(norm) or norm == 0:
        raise HTTPException(status_code=500, detail="Model returned an invalid vector")
    return (vector / norm).astype(float).tolist()


def normalize_batch(values: np.ndarray) -> list[list[float]]:
    matrix = np.asarray(values, dtype=np.float32)
    if matrix.ndim == 1:
        matrix = matrix.reshape(1, -1)
    if matrix.ndim != 2:
        raise HTTPException(status_code=500, detail=f"Expected a 2D embedding batch, got shape {matrix.shape}")
    return [normalize(row) for row in matrix]


def response_for(values: np.ndarray, source: str) -> dict[str, Any]:
    return {
        "embedding": normalize(values),
        "model": MODEL_NAME,
        "provider": "hf-jina-v5-omni",
        "source": source,
        "dimensions": DIMENSIONS,
        "device": device,
    }


def batch_response_for(values: np.ndarray, source: str) -> dict[str, Any]:
    embeddings = normalize_batch(values)
    return {
        "results": [
            {
                "embedding": embedding,
                "model": MODEL_NAME,
                "provider": "hf-jina-v5-omni",
                "source": source,
                "dimensions": DIMENSIONS,
                "device": device,
            }
            for embedding in embeddings
        ],
        "model": MODEL_NAME,
        "provider": "hf-jina-v5-omni",
        "source": source,
        "dimensions": DIMENSIONS,
        "device": device,
    }


def embed_processed_inputs(inputs: Any) -> np.ndarray:
    try:
        with torch.inference_mode():
            values = model.embed(truncate_dim=DIMENSIONS, **inputs.to(device))
    except torch.OutOfMemoryError as exc:
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        raise HTTPException(status_code=507, detail="CUDA out of memory while embedding batch") from exc
    return values.detach().cpu().float().numpy()


def suffix_for_image_url(image_url: str) -> str:
    path = urlparse(image_url).path.lower()
    for suffix in (".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"):
        if path.endswith(suffix):
            return suffix
    return ".jpg"


def download_image_to_temp_file(image_url: str) -> str:
    request = Request(image_url, headers={"User-Agent": DOWNLOAD_USER_AGENT})
    try:
        with urlopen(request, timeout=DOWNLOAD_TIMEOUT_SECONDS) as response:
            data = response.read()
    except URLError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to download image: {exc}",
        ) from exc

    if not data:
        raise HTTPException(status_code=502, detail="Downloaded image is empty")

    with tempfile.NamedTemporaryFile(
        mode="wb",
        suffix=suffix_for_image_url(image_url),
        delete=False,
    ) as temp_file:
        temp_file.write(data)
        return temp_file.name


def load_image_from_url(image_url: str) -> tuple[Image.Image, str]:
    image_path = download_image_to_temp_file(image_url)
    try:
        image = Image.open(image_path).convert("RGB")
        if MAX_IMAGE_SIDE > 0 and max(image.size) > MAX_IMAGE_SIDE:
            resample_filter = Image.Resampling.LANCZOS if hasattr(Image, "Resampling") else Image.LANCZOS
            image.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE), resample_filter)
        return image, image_path
    except Exception:
        os.unlink(image_path)
        raise


def image_prompt() -> str:
    return "Document: <|vision_start|><|image_pad|><|vision_end|>"


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "model": MODEL_NAME,
        "dimensions": DIMENSIONS,
        "device": device,
    }


@app.post("/")
@app.post("/embed-image")
def embed_image(
    payload: ImageEmbeddingRequest,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    check_auth(authorization)
    image, image_path = load_image_from_url(payload.imageUrl)
    try:
        inputs = processor(
            images=image,
            text=image_prompt(),
            return_tensors="pt",
            truncation=False,
        )
        values = embed_processed_inputs(inputs)
    finally:
        os.unlink(image_path)
    return response_for(values, "image")


@app.post("/embed-images")
def embed_images(
    payload: ImageBatchEmbeddingRequest,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    check_auth(authorization)
    if not payload.items:
        raise HTTPException(status_code=400, detail="Batch is empty")

    loaded_images = [load_image_from_url(item.imageUrl) for item in payload.items]
    image_paths = [image_path for _, image_path in loaded_images]
    try:
        images = [image for image, _ in loaded_images]
        inputs = processor(
            images=images,
            text=[image_prompt()] * len(images),
            return_tensors="pt",
            truncation=False,
            padding=True,
        )
        values = embed_processed_inputs(inputs)
    finally:
        for image_path in image_paths:
            os.unlink(image_path)
    return batch_response_for(values, "image")


@app.post("/embed-text")
def embed_text(
    payload: TextEmbeddingRequest,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    check_auth(authorization)
    if payload.task == "document":
        text = f"Document: {payload.text}"
    else:
        text = f"Query: {payload.text}"
    inputs = processor(text=text, return_tensors="pt", truncation=True)
    values = embed_processed_inputs(inputs)
    return response_for(values, "text")

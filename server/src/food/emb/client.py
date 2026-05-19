import asyncio
import json
import logging
from urllib import error, request

from src.config import global_settings
from src.food.config import food_settings

logger = logging.getLogger(__name__)


async def request_embeddings(
    inputs: list[str],
) -> list[list[float]]:
    logger.info(
        "Requesting %s embeddings from model provider endpoint=%s model=%s.",
        len(inputs),
        global_settings.embedding_endpoint,
        global_settings.embedding_model,
    )
    return await asyncio.to_thread(_request_embeddings_sync, inputs)


def _request_embeddings_sync(inputs: list[str]) -> list[list[float]]:
    if not global_settings.embedding_endpoint:
        raise RuntimeError("Embedding endpoint is not configured.")
    if not global_settings.embedding_model:
        raise RuntimeError("Embedding model is not configured.")

    payload_dict = _build_embedding_payload(inputs)
    payload = json.dumps(payload_dict).encode("utf-8")
    http_request = request.Request(
        global_settings.embedding_endpoint,
        data=payload,
        headers=global_settings.embedding_request_headers,
        method="POST",
    )

    try:
        with request.urlopen(
            http_request,
            timeout=global_settings.embedding_timeout_seconds,
        ) as response:
            body = response.read().decode("utf-8")
    except error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")
        logger.exception(
            "Model provider embedding request failed with status=%s body=%s.",
            exc.code,
            error_body,
        )
        raise RuntimeError("Failed to request embeddings from model provider.") from exc
    except error.URLError as exc:
        logger.exception("Model provider embedding request failed.")
        raise RuntimeError("Failed to request embeddings from model provider.") from exc

    try:
        response_payload = json.loads(body)
        embeddings = _parse_embedding_response(response_payload)
    except (KeyError, TypeError, ValueError) as exc:
        raise RuntimeError("Invalid embedding response payload.") from exc

    if len(embeddings) != len(inputs):
        raise RuntimeError("Embedding response count does not match request.")

    for embedding in embeddings:
        if len(embedding) != food_settings.embedding_dimensions:
            raise RuntimeError("Embedding dimension does not match configured dimensions.")

    logger.info(
        "Received %s embeddings successfully from model provider.",
        len(embeddings),
    )
    return embeddings


def _build_embedding_payload(inputs: list[str]) -> dict[str, object]:
    payload: dict[str, object] = {
        "model": global_settings.embedding_model,
        "input": inputs,
        "encoding_format": global_settings.embedding_encoding_format,
    }
    return payload


def _parse_embedding_response(
    response_payload: dict[str, object],
) -> list[list[float]]:
    data = response_payload["data"]
    if not isinstance(data, list):
        raise TypeError("Model provider embeddings response data must be a list.")
    return [
        item["embedding"]
        for item in sorted(data, key=lambda item: item["index"])
    ]

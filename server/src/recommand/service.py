import asyncio
import json
import logging
import re
import socket
from urllib import error, request

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth.models import User
from src.config import global_settings
from src.food.emb.client import request_embeddings
from src.food.enum import FoodStatusEnum
from src.food.models import Food
from src.food.schemas import FoodRead

from .exceptions import NotEnoughRecommendationCandidatesException
from .schemas import PreferenceFood, RecommendationItem, RecommendationResponse

logger = logging.getLogger(__name__)


def _build_instructed_query(task_description: str, query: str) -> str:
    return f"Instruct: {task_description}\nQuery: {query}"


def _build_preference_text(preference: PreferenceFood) -> str:
    query_payload = {
        "cuisine": [item.value for item in preference.cuisine] or None,
        "meal_type": [item.value for item in preference.meal_type] or None,
        "price_range": [item.value for item in preference.price_range] or None,
        "convenience": [item.value for item in preference.convenience] or None,
        "extra_request": preference.extra_request or None,
    }
    query_payload = {
        key: value
        for key, value in query_payload.items()
        if value is not None
    }
    body = json.dumps(query_payload, ensure_ascii=False)
    if global_settings.vllm_embedding_query_instruction:
        return _build_instructed_query(
            global_settings.vllm_embedding_query_instruction,
            body,
        )
    return body


def _build_rerank_query_text(preference: PreferenceFood) -> str:
    query_payload = {
        "cuisine": [item.value for item in preference.cuisine] or None,
        "meal_type": [item.value for item in preference.meal_type] or None,
        "price_range": [item.value for item in preference.price_range] or None,
        "convenience": [item.value for item in preference.convenience] or None,
        "extra_request": preference.extra_request or None,
    }
    query_payload = {
        key: value
        for key, value in query_payload.items()
        if value is not None
    }
    body = json.dumps(query_payload, ensure_ascii=False)
    if global_settings.vllm_rerank_instruction:
        return _build_instructed_query(global_settings.vllm_rerank_instruction, body)
    return body


def _build_rerank_document(food: Food) -> str:
    return "\n".join(
        [
            f"name: {food.name}",
            f"description: {food.description or ''}",
            f"cuisine: {food.cuisine.value if food.cuisine else ''}",
            f"meal_type: {food.meal_type.value if food.meal_type else ''}",
            f"price_range: {food.price_range.value}",
            f"convenience: {food.convenience.value}",
            f"is_favorite: {food.is_favorite}",
        ]
    )


def _candidate_filters(user_id, preference: PreferenceFood) -> list[object]:
    filters: list[object] = [
        Food.user_id == user_id,
        Food.status == FoodStatusEnum.ACTIVE,
        Food.is_recycled.is_(False),
        Food.embedding.is_not(None),
    ]

    if preference.only_from_favorite:
        filters.append(Food.is_favorite.is_(True))

    return filters


async def _count_candidates(
    session: AsyncSession,
    user: User,
    preference: PreferenceFood,
) -> int:
    statement = select(func.count()).select_from(Food).where(
        *_candidate_filters(user.id, preference)
    )
    result = await session.execute(statement)
    count = int(result.scalar_one() or 0)
    logger.info("Recommendation candidate pool count user_id=%s count=%s.", user.id, count)
    return count


async def _fetch_coarse_candidates(
    session: AsyncSession,
    user: User,
    preference: PreferenceFood,
    query_embedding: list[float],
) -> list[dict[str, object]]:
    distance_expr = Food.embedding.cosine_distance(query_embedding)
    statement = (
        select(Food, distance_expr.label("distance"))
        .where(*_candidate_filters(user.id, preference))
        .order_by(distance_expr.asc(), Food.updated_at.desc())
        .limit(global_settings.recommendation_coarse_top_k)
    )
    result = await session.execute(statement)
    rows = result.all()
    coarse_candidates = [
        {
            "food": row[0],
            "coarse_distance": float(row[1]),
            "coarse_rank": index + 1,
        }
        for index, row in enumerate(rows)
    ]
    logger.info(
        "Fetched %s coarse recommendation candidates for user_id=%s.",
        len(coarse_candidates),
        user.id,
    )
    return coarse_candidates

async def _request_rerank_scores(
    query_text: str,
    coarse_candidates: list[dict[str, object]],
) -> dict[str, float]:
    if not global_settings.vllm_rerank_endpoint or not global_settings.vllm_rerank_model:
        return {}

    payload = json.dumps(
        {
            "model": global_settings.vllm_rerank_model,
            "queries": query_text,
            "documents": [
                _build_rerank_document(candidate["food"])  # type: ignore[arg-type]
                for candidate in coarse_candidates
            ],
        }
    ).encode("utf-8")
    http_request = request.Request(
        global_settings.vllm_rerank_endpoint,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    def _run_sync() -> dict[str, float]:
        try:
            with request.urlopen(
                http_request,
                timeout=global_settings.vllm_rerank_timeout_seconds,
            ) as response:
                body = response.read().decode("utf-8")
        except (TimeoutError, socket.timeout) as exc:
            logger.warning(
                "External rerank request timed out after %s seconds.",
                global_settings.vllm_rerank_timeout_seconds,
            )
            raise RuntimeError("Rerank request timed out.") from exc
        except error.URLError as exc:
            logger.exception("External rerank request failed.")
            raise RuntimeError("Failed to request rerank results.") from exc

        response_payload = json.loads(body)
        items = response_payload.get("data") or response_payload.get("results") or []
        scores: dict[str, float] = {}
        for item in items:
            index = item.get("index", item.get("document_index"))
            if not isinstance(index, int) or index >= len(coarse_candidates):
                continue
            food = coarse_candidates[index]["food"]  # type: ignore[index]
            scores[str(food.id)] = float(
                item.get("relevance_score", item.get("score", 0.0))
            )
        return scores

    logger.info(
        "Requesting external rerank for %s recommendation candidates.",
        len(coarse_candidates),
    )
    return await asyncio.to_thread(_run_sync)


def _fallback_reason(preference: PreferenceFood, food: Food) -> str:
    matched_bits: list[str] = []
    if preference.cuisine and food.cuisine in preference.cuisine:
        matched_bits.append(f"{food.cuisine.value} cuisine")
    if preference.meal_type and food.meal_type in preference.meal_type:
        matched_bits.append(f"{food.meal_type.value} timing")
    if preference.price_range and food.price_range in preference.price_range:
        matched_bits.append(f"{food.price_range.value} price range")
    if preference.convenience and food.convenience in preference.convenience:
        matched_bits.append(f"{food.convenience.value} convenience")
    if food.is_favorite:
        matched_bits.append("favorite history")

    reason = f"{food.name} stands out because it fits your current preference profile"
    if matched_bits:
        reason += " through " + ", ".join(matched_bits)
    if food.description:
        reason += f", and its {food.description.lower()}"
    if preference.extra_request:
        reason += f" also lines up with your extra request for {preference.extra_request}"
    reason += "."
    return reason


def _is_reason_usable(reason: str | None) -> bool:
    if not reason:
        return False

    normalized = reason.strip()
    if len(normalized) < 32:
        return False

    lower = normalized.lower()
    if (
        "," in normalized
        and "." not in normalized
        and "because" not in lower
        and "fits" not in lower
        and "works" not in lower
        and "good" not in lower
        and "great" not in lower
        and "balanced" not in lower
        and "suits" not in lower
    ):
        return False

    if len(normalized.split()) < 6:
        return False

    return True


def _strip_code_fences(content: str) -> str:
    normalized = content.strip()
    if normalized.startswith("```"):
        normalized = re.sub(r"^```(?:json)?", "", normalized).strip()
        normalized = re.sub(r"```$", "", normalized).strip()
    return normalized


async def _generate_llm_reasons(
    preference: PreferenceFood,
    selected_candidates: list[dict[str, object]],
) -> dict[str, str]:
    if not global_settings.vllm_chat_endpoint or not global_settings.vllm_chat_model:
        return {}

    def _run_sync(candidate: dict[str, object]) -> tuple[str, str]:
        food = candidate["food"]  # type: ignore[index]
        prompt = {
            "preference": preference.model_dump(mode="json", exclude_none=True),
            "food": {
                "id": str(food.id),
                "name": food.name,
                "description": food.description,
                "cuisine": food.cuisine.value if food.cuisine else None,
                "meal_type": food.meal_type.value if food.meal_type else None,
                "price_range": food.price_range.value,
                "convenience": food.convenience.value,
                "is_favorite": food.is_favorite,
            },
            "requirements": [
                "Write exactly one natural-sounding recommendation reason for this food.",
                "Keep it to 1-2 sentences and make it user-facing.",
                "Mention the food name and at least one concrete detail from the description when available.",
                "Explain why it matches the user's stated preferences or extra request.",
                "Do not just list tags or attributes.",
                "Do not mention scores, ranks, embeddings, candidate pools, or system internals.",
            ],
        }
        payload = json.dumps(
            {
                "model": global_settings.vllm_chat_model,
                "temperature": 0.2,
                "max_tokens": global_settings.vllm_chat_max_tokens,
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            "You generate one natural, concise food recommendation reason for an end user. "
                            "The answer must sound like a real recommendation, not a tag dump. "
                            "Return only the recommendation reason as plain text. "
                            "Do not include JSON, markdown, bullet points, labels, or quotation marks."
                        ),
                    },
                    {
                        "role": "user",
                        "content": json.dumps(prompt, ensure_ascii=False),
                    },
                ],
            }
        ).encode("utf-8")
        http_request = request.Request(
            global_settings.vllm_chat_endpoint,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with request.urlopen(
                http_request,
                timeout=global_settings.vllm_chat_timeout_seconds,
            ) as response:
                body = response.read().decode("utf-8")
        except (TimeoutError, socket.timeout) as exc:
            logger.warning(
                "External LLM reason generation timed out after %s seconds.",
                global_settings.vllm_chat_timeout_seconds,
            )
            raise RuntimeError("LLM reason generation timed out.") from exc
        except error.URLError as exc:
            logger.exception("External LLM reason generation failed.")
            raise RuntimeError("Failed to generate recommendation reasons.") from exc

        response_payload = json.loads(body)
        content = (
            response_payload.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
        )
        reason = _strip_code_fences(content).strip()
        if not reason:
            raise RuntimeError("LLM reason generation returned empty content.")
        return str(food.id), reason

    logger.info(
        "Requesting external LLM reasons individually for %s recommendation candidates.",
        len(selected_candidates),
    )
    tasks = [
        asyncio.to_thread(_run_sync, candidate)
        for candidate in selected_candidates
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    reasons: dict[str, str] = {}
    for result in results:
        if isinstance(result, Exception):
            logger.warning(
                "Skipping one LLM-generated reason because an individual request failed: %s",
                result,
            )
            continue
        food_id, reason = result
        reasons[food_id] = reason

    return reasons


async def recommend_foods(
    session: AsyncSession,
    user: User,
    preference: PreferenceFood,
) -> RecommendationResponse:
    candidate_pool_size = await _count_candidates(session, user, preference)
    if candidate_pool_size < global_settings.recommendation_candidate_pool_minimum:
        raise NotEnoughRecommendationCandidatesException(
            minimum=global_settings.recommendation_candidate_pool_minimum,
            actual=candidate_pool_size,
        )

    query_text = _build_preference_text(preference)
    query_embedding = (await request_embeddings([query_text]))[0]
    coarse_candidates = await _fetch_coarse_candidates(session, user, preference, query_embedding)
    rerank_query_text = _build_rerank_query_text(preference)

    external_rerank_scores: dict[str, float] = {}
    if global_settings.vllm_rerank_endpoint and global_settings.vllm_rerank_model:
        try:
            external_rerank_scores = await _request_rerank_scores(
                rerank_query_text,
                coarse_candidates,
            )
        except Exception as exc:
            logger.warning(
                "Falling back to coarse ranking because external rerank failed: %s",
                exc,
            )

    scored_candidates: list[dict[str, object]] = []
    for candidate in coarse_candidates:
        food = candidate["food"]  # type: ignore[index]
        coarse_distance = float(candidate["coarse_distance"])  # type: ignore[arg-type]
        rerank_score = external_rerank_scores.get(str(food.id), 1.0 - coarse_distance)
        scored_candidates.append(
            {
                **candidate,
                "rerank_score": float(rerank_score),
            }
        )

    scored_candidates.sort(
        key=lambda item: (-float(item["rerank_score"]), float(item["coarse_distance"]))
    )
    final_candidates = scored_candidates[: global_settings.recommendation_final_top_k]

    llm_reasons: dict[str, str] = {}
    if global_settings.vllm_chat_endpoint and global_settings.vllm_chat_model:
        try:
            llm_reasons = await _generate_llm_reasons(preference, final_candidates)
        except Exception as exc:
            logger.warning(
                "Falling back to template recommendation reasons because LLM generation failed: %s",
                exc,
            )

    recommendations = [
        RecommendationItem(
            food=FoodRead.model_validate(candidate["food"]),
            coarse_rank=int(candidate["coarse_rank"]),
            coarse_distance=float(candidate["coarse_distance"]),
            rerank_score=float(candidate["rerank_score"]),
            reason=(
                llm_reasons[str(candidate["food"].id)]
                if _is_reason_usable(
                    llm_reasons.get(str(candidate["food"].id))  # type: ignore[index]
                )
                else _fallback_reason(preference, candidate["food"])  # type: ignore[arg-type]
            ),
        )
        for candidate in final_candidates
    ]
    logger.info(
        "Built %s final recommendations for user_id=%s candidate_pool_size=%s.",
        len(recommendations),
        user.id,
        candidate_pool_size,
    )
    return RecommendationResponse(
        candidate_pool_size=candidate_pool_size,
        coarse_top_k=global_settings.recommendation_coarse_top_k,
        final_top_k=global_settings.recommendation_final_top_k,
        recommendations=recommendations,
    )

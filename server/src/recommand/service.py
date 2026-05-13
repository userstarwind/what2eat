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
from src.food.enum import FoodEmbeddingStatusEnum, FoodStatusEnum
from src.food.models import Food
from src.food.schemas import FoodRead
from src.history.service import create_recommendation_history

from .exceptions import NotEnoughRecommendationCandidatesException
from .schemas import (
    PreferenceFood,
    RecommendationDiagnostics,
    RecommendationItem,
    RecommendationResponse,
)

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
    if global_settings.embedding_query_instruction:
        return _build_instructed_query(
            global_settings.embedding_query_instruction,
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
    if global_settings.rerank_instruction:
        return _build_instructed_query(global_settings.rerank_instruction, body)
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


def _candidate_filters(
    user_id,
    preference: PreferenceFood,
    *,
    require_embedding: bool = False,
) -> list[object]:
    filters: list[object] = [
        Food.user_id == user_id,
        Food.status == FoodStatusEnum.ACTIVE,
        Food.is_recycled.is_(False),
    ]
    if require_embedding:
        filters.extend(
            [
                Food.embedding.is_not(None),
                Food.embedding_status == FoodEmbeddingStatusEnum.READY,
            ]
        )

    if preference.only_from_favorite:
        filters.append(Food.is_favorite.is_(True))

    if preference.exclude_food_ids:
        filters.append(Food.id.notin_(preference.exclude_food_ids))

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
        .where(*_candidate_filters(user.id, preference, require_embedding=True))
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
        "Fetched %s coarse recommendation candidates for user_id=%s excluded_count=%s.",
        len(coarse_candidates),
        user.id,
        len(preference.exclude_food_ids),
    )
    return coarse_candidates


def _tokenize_extra_request(extra_request: str | None) -> set[str]:
    if not extra_request:
        return set()
    return {
        token
        for token in re.findall(r"[A-Za-z0-9]+", extra_request.lower())
        if len(token) >= 3
    }


def _rule_match_score(preference: PreferenceFood, food: Food) -> float:
    score = 0.0
    if preference.cuisine and food.cuisine in preference.cuisine:
        score += 3.0
    if preference.meal_type and food.meal_type in preference.meal_type:
        score += 3.0
    if preference.price_range and food.price_range in preference.price_range:
        score += 2.0
    if preference.convenience and food.convenience in preference.convenience:
        score += 2.0
    if food.is_favorite:
        score += 0.75

    request_tokens = _tokenize_extra_request(preference.extra_request)
    if request_tokens:
        searchable_text = f"{food.name} {food.description or ''}".lower()
        matched_tokens = sum(1 for token in request_tokens if token in searchable_text)
        score += min(float(matched_tokens) * 0.35, 1.5)

    return score


def _max_rule_score(preference: PreferenceFood) -> float:
    score = 0.75
    if preference.cuisine:
        score += 3.0
    if preference.meal_type:
        score += 3.0
    if preference.price_range:
        score += 2.0
    if preference.convenience:
        score += 2.0
    if preference.extra_request:
        score += 1.5
    return score


async def _fetch_rule_candidates(
    session: AsyncSession,
    user: User,
    preference: PreferenceFood,
    *,
    excluded_candidate_ids: set[str] | None = None,
    limit: int | None = None,
    start_rank: int = 1,
) -> list[dict[str, object]]:
    excluded_candidate_ids = excluded_candidate_ids or set()
    limit = limit or global_settings.recommendation_coarse_top_k
    statement = (
        select(Food)
        .where(*_candidate_filters(user.id, preference))
        .order_by(Food.updated_at.desc())
    )
    result = await session.execute(statement)
    foods = list(result.scalars().all())
    max_score = _max_rule_score(preference)

    scored_foods = [
        {
            "food": food,
            "rule_score": _rule_match_score(preference, food),
        }
        for food in foods
        if str(food.id) not in excluded_candidate_ids
    ]
    scored_foods.sort(
        key=lambda item: (
            -float(item["rule_score"]),
            not bool(item["food"].is_favorite),  # type: ignore[index]
            -item["food"].updated_at.timestamp(),  # type: ignore[index]
        ),
    )

    candidates: list[dict[str, object]] = []
    for index, item in enumerate(
        scored_foods[:limit],
        start=start_rank,
    ):
        normalized_score = min(max(float(item["rule_score"]) / max_score, 0.0), 1.0)
        candidates.append(
            {
                "food": item["food"],
                "coarse_distance": 1.0 - normalized_score,
                "coarse_rank": index,
                "rule_score": normalized_score,
            }
        )

    logger.info(
        "Fetched %s rule recommendation candidates for user_id=%s excluded_count=%s.",
        len(candidates),
        user.id,
        len(preference.exclude_food_ids),
    )
    return candidates


async def _request_rerank_scores(
    query_text: str,
    coarse_candidates: list[dict[str, object]],
) -> dict[str, float]:
    if not global_settings.rerank_endpoint or not global_settings.rerank_model:
        return {}

    payload = json.dumps(
        {
            "model": global_settings.rerank_model,
            "queries": query_text,
            "documents": [
                _build_rerank_document(candidate["food"])  # type: ignore[arg-type]
                for candidate in coarse_candidates
            ],
        }
    ).encode("utf-8")
    http_request = request.Request(
        global_settings.rerank_endpoint,
        data=payload,
        headers=global_settings.model_request_headers,
        method="POST",
    )

    def _run_sync() -> dict[str, float]:
        try:
            with request.urlopen(
                http_request,
                timeout=global_settings.rerank_timeout_seconds,
            ) as response:
                body = response.read().decode("utf-8")
        except (TimeoutError, socket.timeout) as exc:
            logger.warning(
                "External rerank request timed out after %s seconds.",
                global_settings.rerank_timeout_seconds,
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


def _humanize_enum(value: str) -> str:
    return value.replace("_", " ")


def _describe_price(value: str) -> str:
    return {
        "low": "budget-friendly",
        "medium": "moderately priced",
        "high": "a bit more special",
    }.get(value, _humanize_enum(value))


def _describe_convenience(value: str) -> str:
    return {
        "low": "worth taking a little more time for",
        "medium": "easy enough for a normal day",
        "high": "quick and low-effort",
    }.get(value, _humanize_enum(value))


def _clean_description(description: str | None) -> str | None:
    if not description:
        return None
    normalized = re.sub(r"\s+", " ", description.strip()).rstrip(".")
    return normalized or None


def _fallback_reason(preference: PreferenceFood, food: Food) -> str:
    matched_phrases: list[str] = []
    if preference.cuisine and food.cuisine in preference.cuisine:
        matched_phrases.append(f"a {_humanize_enum(food.cuisine.value)} craving")
    if preference.meal_type and food.meal_type in preference.meal_type:
        matched_phrases.append(f"{food.meal_type.value} plans")
    if preference.price_range and food.price_range in preference.price_range:
        matched_phrases.append(_describe_price(food.price_range.value))
    if preference.convenience and food.convenience in preference.convenience:
        matched_phrases.append(_describe_convenience(food.convenience.value))
    if food.is_favorite:
        matched_phrases.append("something you have already marked as a favorite")

    description = _clean_description(food.description)
    lead_index = food.id.int % 3
    match_text = " and ".join(matched_phrases[:2])
    if len(matched_phrases) > 2:
        match_text += f", with {matched_phrases[2]} in the mix"

    if match_text and description:
        options = [
            (
                f"{food.name} is a strong fit for {match_text}, and the detail that "
                f"stands out is {description.lower()}."
            ),
            (
                f"{food.name} should work well here: it covers {match_text} while "
                f"bringing {description.lower()}."
            ),
            (
                f"{food.name} feels like a good pick because it matches {match_text}. "
                f"The {description.lower()} makes it feel more specific than a generic choice."
            ),
        ]
        return options[lead_index]

    if match_text:
        options = [
            f"{food.name} fits this request nicely because it lines up with {match_text}.",
            f"{food.name} is a sensible choice here, especially for {match_text}.",
            f"{food.name} should suit the moment well because it matches {match_text}.",
        ]
        return options[lead_index]

    if description:
        options = [
            f"{food.name} is worth considering for this round, especially for its {description.lower()}.",
            f"{food.name} brings {description.lower()}, which gives it a clear reason to be on the list.",
            f"{food.name} stands out here because of its {description.lower()}.",
        ]
        return options[lead_index]

    return f"{food.name} is a solid option from your active foods for this set of preferences."


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
    if not global_settings.chat_endpoint or not global_settings.chat_model:
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
                "model": global_settings.chat_model,
                "temperature": 0.2,
                "max_tokens": global_settings.chat_max_tokens,
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
            global_settings.chat_endpoint,
            data=payload,
            headers=global_settings.model_request_headers,
            method="POST",
        )
        try:
            with request.urlopen(
                http_request,
                timeout=global_settings.chat_timeout_seconds,
            ) as response:
                body = response.read().decode("utf-8")
        except (TimeoutError, socket.timeout) as exc:
            logger.warning(
                "External LLM reason generation timed out after %s seconds.",
                global_settings.chat_timeout_seconds,
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
    fallback_reasons: list[str] = []
    candidate_pool_size = await _count_candidates(session, user, preference)
    if candidate_pool_size < global_settings.recommendation_candidate_pool_minimum:
        raise NotEnoughRecommendationCandidatesException(
            minimum=global_settings.recommendation_candidate_pool_minimum,
            actual=candidate_pool_size,
        )

    recall_source = "embedding"
    coarse_candidates: list[dict[str, object]] = []
    embedding_recall_failed = False
    if global_settings.embedding_endpoint and global_settings.embedding_model:
        try:
            query_text = _build_preference_text(preference)
            query_embedding = (await request_embeddings([query_text]))[0]
            coarse_candidates = await _fetch_coarse_candidates(
                session,
                user,
                preference,
                query_embedding,
            )
        except Exception as exc:
            embedding_recall_failed = True
            fallback_reasons.append("Embedding recall failed; used rule-based recall.")
            logger.warning(
                "Falling back to rule-based recommendation recall because embedding failed: %s",
                exc,
            )
    else:
        fallback_reasons.append("Embedding model is not configured; used rule-based recall.")
        logger.info("Using rule-based recommendation recall because embedding is not configured.")

    if (
        coarse_candidates
        and len(coarse_candidates) < global_settings.recommendation_coarse_top_k
    ):
        fill_count = global_settings.recommendation_coarse_top_k - len(coarse_candidates)
        rule_candidates = await _fetch_rule_candidates(
            session,
            user,
            preference,
            excluded_candidate_ids={
                str(candidate["food"].id)  # type: ignore[index]
                for candidate in coarse_candidates
            },
            limit=fill_count,
            start_rank=len(coarse_candidates) + 1,
        )
        if rule_candidates:
            recall_source = "mixed"
            coarse_candidates.extend(rule_candidates)
            fallback_reasons.append(
                "Embedding recall covered part of the pool; rule recall filled the remaining candidates."
            )

    if not coarse_candidates:
        if (
            global_settings.embedding_endpoint
            and global_settings.embedding_model
            and not embedding_recall_failed
        ):
            fallback_reasons.append(
                "Embedding recall returned no ready candidates; used rule-based recall."
            )
            logger.warning("Embedding recall returned no ready candidates; using rule-based recall.")
        recall_source = "rule"
        coarse_candidates = await _fetch_rule_candidates(session, user, preference)

    rerank_query_text = _build_rerank_query_text(preference)

    external_rerank_scores: dict[str, float] = {}
    rerank_source = "coarse_score"
    if global_settings.rerank_endpoint and global_settings.rerank_model:
        try:
            external_rerank_scores = await _request_rerank_scores(
                rerank_query_text,
                coarse_candidates,
            )
            if external_rerank_scores:
                rerank_source = (
                    "external"
                    if len(external_rerank_scores) == len(coarse_candidates)
                    else "mixed"
                )
                if rerank_source == "mixed":
                    fallback_reasons.append(
                        "External rerank returned partial scores; missing scores used recall scores."
                    )
            else:
                fallback_reasons.append(
                    "External rerank returned no usable scores; used recall scores."
                )
        except Exception as exc:
            fallback_reasons.append("External rerank failed; used recall scores.")
            logger.warning(
                "Falling back to coarse ranking because external rerank failed: %s",
                exc,
            )
    else:
        fallback_reasons.append("Rerank model is not configured; used recall scores.")

    scored_candidates: list[dict[str, object]] = []
    for candidate in coarse_candidates:
        food = candidate["food"]  # type: ignore[index]
        coarse_distance = float(candidate["coarse_distance"])  # type: ignore[arg-type]
        recall_score = float(candidate.get("rule_score", 1.0 - coarse_distance))
        rerank_score = external_rerank_scores.get(str(food.id), recall_score)
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
    reason_source = "template"
    if global_settings.chat_endpoint and global_settings.chat_model:
        try:
            llm_reasons = await _generate_llm_reasons(preference, final_candidates)
        except Exception as exc:
            fallback_reasons.append("LLM reason generation failed; used template reasons.")
            logger.warning(
                "Falling back to template recommendation reasons because LLM generation failed: %s",
                exc,
            )
    else:
        fallback_reasons.append("LLM reason model is not configured; used template reasons.")

    recommendations: list[RecommendationItem] = []
    llm_reason_count = 0
    for candidate in final_candidates:
        food = candidate["food"]  # type: ignore[index]
        llm_reason = llm_reasons.get(str(food.id))
        if _is_reason_usable(llm_reason):
            reason = llm_reason or ""
            llm_reason_count += 1
        else:
            reason = _fallback_reason(preference, food)  # type: ignore[arg-type]
        recommendations.append(
            RecommendationItem(
                food=FoodRead.model_validate(food),
                coarse_rank=int(candidate["coarse_rank"]),
                coarse_distance=float(candidate["coarse_distance"]),
                rerank_score=float(candidate["rerank_score"]),
                reason=reason,
            )
        )

    if llm_reason_count == len(final_candidates) and final_candidates:
        reason_source = "llm"
    elif llm_reason_count:
        reason_source = "mixed"
        fallback_reasons.append(
            "Some LLM reasons were missing or unusable; template reasons filled the gaps."
        )
    elif global_settings.chat_endpoint and global_settings.chat_model:
        fallback_reasons.append(
            "LLM returned no usable reasons; used template reasons."
        )

    recommendation_mode = "model"
    if recall_source == "rule":
        recommendation_mode = "rule"
    elif fallback_reasons:
        recommendation_mode = "hybrid"

    diagnostics = RecommendationDiagnostics(
        recommendation_mode=recommendation_mode,
        recall_source=recall_source,
        rerank_source=rerank_source,
        reason_source=reason_source,
        fallback_reasons=list(dict.fromkeys(fallback_reasons)),
    )
    logger.info(
        "Built %s final recommendations for user_id=%s candidate_pool_size=%s "
        "excluded_count=%s mode=%s recall_source=%s rerank_source=%s reason_source=%s.",
        len(recommendations),
        user.id,
        candidate_pool_size,
        len(preference.exclude_food_ids),
        diagnostics.recommendation_mode,
        diagnostics.recall_source,
        diagnostics.rerank_source,
        diagnostics.reason_source,
    )
    response = RecommendationResponse(
        candidate_pool_size=candidate_pool_size,
        coarse_top_k=global_settings.recommendation_coarse_top_k,
        final_top_k=global_settings.recommendation_final_top_k,
        diagnostics=diagnostics,
        recommendations=recommendations,
    )
    history = await create_recommendation_history(session, user, preference, response)
    return response.model_copy(update={"history_id": history.id})

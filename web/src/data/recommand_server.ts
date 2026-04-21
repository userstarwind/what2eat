import type {
  Convenience,
  Cuisine,
  FoodReadResp,
  MealType,
  PriceRange,
} from './food_server';
import { http } from './server_tools';
import { getAuthorizationHeader } from './user_server';

export interface RecommendationRequest {
  cuisine?: Cuisine[];
  meal_type?: MealType[];
  price_range?: PriceRange[];
  convenience?: Convenience[];
  only_from_favorite?: boolean;
  extra_request?: string | null;
  exclude_food_ids?: string[];
}

export interface RecommendationItem {
  food: FoodReadResp;
  coarse_rank: number;
  coarse_distance: number;
  rerank_score: number;
  reason: string;
}

export interface RecommendationResponse {
  candidate_pool_size: number;
  coarse_top_k: number;
  final_top_k: number;
  recommendations: RecommendationItem[];
}

function getAuthHeaders(): HeadersInit | undefined {
  const authorization = getAuthorizationHeader();
  return authorization ? { Authorization: authorization } : undefined;
}

export function recommendFoodsApi(
  payload: RecommendationRequest,
): Promise<RecommendationResponse> {
  return http<RecommendationResponse, RecommendationRequest>('/recommendations', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: payload,
  });
}

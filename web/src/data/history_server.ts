import type {
  Convenience,
  Cuisine,
  FoodReadResp,
  MealType,
  PriceRange,
} from './food_server';
import { http } from './server_tools';
import { getAuthorizationHeader } from './user_server';

export interface RecommendationPreferenceSnapshot {
  cuisine: Cuisine[];
  meal_type: MealType[];
  price_range: PriceRange[];
  convenience: Convenience[];
  only_from_favorite: boolean;
  extra_request: string | null;
  exclude_food_ids: string[];
}

export interface RecommendationHistoryItem {
  id: string;
  food_id: string | null;
  rank: number;
  coarse_rank: number;
  coarse_distance: number;
  rerank_score: number;
  reason: string;
  food_snapshot: FoodReadResp;
}

export interface RecommendationDiagnosticsSnapshot {
  recommendation_mode: string;
  recall_source: string;
  rerank_source: string;
  reason_source: string;
  fallback_reasons: string[];
}

export interface RecommendationHistorySummary {
  id: string;
  preference_snapshot: RecommendationPreferenceSnapshot;
  diagnostics_snapshot: RecommendationDiagnosticsSnapshot | null;
  candidate_pool_size: number;
  coarse_top_k: number;
  final_top_k: number;
  recommendation_count: number;
  created_at: string;
}

export interface RecommendationHistoryRead {
  id: string;
  preference_snapshot: RecommendationPreferenceSnapshot;
  diagnostics_snapshot: RecommendationDiagnosticsSnapshot | null;
  candidate_pool_size: number;
  coarse_top_k: number;
  final_top_k: number;
  created_at: string;
  recommendations: RecommendationHistoryItem[];
}

export interface RecommendationHistoryListResponse {
  total: number;
  limit: number;
  offset: number;
  items: RecommendationHistorySummary[];
}

export interface ListRecommendationHistoriesParams {
  limit?: number;
  offset?: number;
}

function getAuthHeaders(): HeadersInit | undefined {
  const authorization = getAuthorizationHeader();
  return authorization ? { Authorization: authorization } : undefined;
}

function buildHistoryListQuery(
  params: ListRecommendationHistoriesParams = {},
): string {
  const searchParams = new URLSearchParams();

  if (typeof params.limit === 'number') {
    searchParams.set('limit', String(params.limit));
  }
  if (typeof params.offset === 'number') {
    searchParams.set('offset', String(params.offset));
  }

  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

export function listRecommendationHistoriesApi(
  params: ListRecommendationHistoriesParams = {},
): Promise<RecommendationHistoryListResponse> {
  return http<RecommendationHistoryListResponse>(
    `/recommendation-histories${buildHistoryListQuery(params)}`,
    {
      headers: getAuthHeaders(),
    },
  );
}

export function getRecommendationHistoryApi(
  historyId: string,
): Promise<RecommendationHistoryRead> {
  return http<RecommendationHistoryRead>(`/recommendation-histories/${historyId}`, {
    headers: getAuthHeaders(),
  });
}

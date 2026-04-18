import { http } from './server_tools';
import { getAuthorizationHeader } from './user_server';

export type FoodStatus =
  | 'wait_for_process'
  | 'processing'
  | 'active'
  | 'inactive'
  | 'failed';
export type FoodListView = 'all' | 'favorites' | 'recycle';
export type Cuisine =
  | 'chinese'
  | 'japanese'
  | 'korean'
  | 'western'
  | 'thai'
  | 'indian'
  | 'fast_food';
export type MealType = 'breakfast' | 'lunch' | 'dinner';
export type PriceRange = 'low' | 'medium' | 'high';
export type Convenience = 'low' | 'medium' | 'high';

export interface FoodCreateReq {
  name: string;
  description?: string | null;
  cuisine?: Cuisine | null;
  meal_type?: MealType | null;
  price_range?: PriceRange;
  convenience?: Convenience;
}

export interface FoodEditReq {
  name?: string;
  description?: string | null;
  cuisine?: Cuisine | null;
  meal_type?: MealType | null;
  price_range?: PriceRange | null;
  convenience?: Convenience | null;
  status?: FoodStatus | null;
}

export interface FoodReadResp {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  cuisine: Cuisine | null;
  meal_type: MealType | null;
  price_range: PriceRange;
  convenience: Convenience;
  status: FoodStatus;
  version: number;
  is_favorite: boolean;
  is_recycled: boolean;
  created_at: string;
  updated_at: string;
}

export interface ListFoodsParams {
  view?: FoodListView;
  keyword?: string;
  status?: FoodStatus;
  cuisine?: Cuisine;
  meal_type?: MealType;
  price_range?: PriceRange;
  convenience?: Convenience;
}

function getAuthHeaders(): HeadersInit | undefined {
  const authorization = getAuthorizationHeader();
  return authorization ? { Authorization: authorization } : undefined;
}

function buildFoodListQuery(params: ListFoodsParams = {}): string {
  const searchParams = new URLSearchParams();

  if (params.view === 'favorites') {
    searchParams.set('favorites_only', 'true');
  }
  if (params.view === 'recycle') {
    searchParams.set('recycled_only', 'true');
  }
  if (params.keyword?.trim()) {
    searchParams.set('keyword', params.keyword.trim());
  }
  if (params.status) {
    searchParams.set('status', params.status);
  }
  if (params.cuisine) {
    searchParams.set('cuisine', params.cuisine);
  }
  if (params.meal_type) {
    searchParams.set('meal_type', params.meal_type);
  }
  if (params.price_range) {
    searchParams.set('price_range', params.price_range);
  }
  if (params.convenience) {
    searchParams.set('convenience', params.convenience);
  }

  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

export function listFoodsApi(params: ListFoodsParams = {}): Promise<FoodReadResp[]> {
  return http<FoodReadResp[]>(`/foods${buildFoodListQuery(params)}`, {
    headers: getAuthHeaders(),
  });
}

export function getFoodApi(foodId: string): Promise<FoodReadResp> {
  return http<FoodReadResp>(`/foods/${foodId}`, {
    headers: getAuthHeaders(),
  });
}

export function createFoodApi(req: FoodCreateReq): Promise<FoodReadResp> {
  return http<FoodReadResp, FoodCreateReq>('/foods', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: req,
  });
}

export function editFoodApi(foodId: string, req: FoodEditReq): Promise<FoodReadResp> {
  return http<FoodReadResp, FoodEditReq>(`/foods/${foodId}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: req,
  });
}

export function favoriteFoodApi(foodId: string): Promise<FoodReadResp> {
  return http<FoodReadResp>(`/foods/${foodId}/favorite`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
}

export function unfavoriteFoodApi(foodId: string): Promise<FoodReadResp> {
  return http<FoodReadResp>(`/foods/${foodId}/favorite`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
}

export function recycleFoodApi(foodId: string): Promise<FoodReadResp> {
  return http<FoodReadResp>(`/foods/${foodId}/recycle`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
}

export function restoreFoodApi(foodId: string): Promise<FoodReadResp> {
  return http<FoodReadResp>(`/foods/${foodId}/restore`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
}

export function activateFoodApi(foodId: string): Promise<FoodReadResp> {
  return http<FoodReadResp>(`/foods/${foodId}/activate`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
}

export function deactivateFoodApi(foodId: string): Promise<FoodReadResp> {
  return http<FoodReadResp>(`/foods/${foodId}/deactivate`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
}

export function deleteFoodApi(foodId: string): Promise<void> {
  return http<void>(`/foods/${foodId}/purge`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
}

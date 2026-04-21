import type {
  Convenience,
  Cuisine,
  MealType,
  PriceRange,
} from '../data/food_server';
import type { RecommendationPreferenceSnapshot } from '../data/history_server';
import type { RecommendationRequest } from '../data/recommand_server';

export const cuisineOptions: Array<{ value: Cuisine; label: string }> = [
  { value: 'chinese', label: 'Chinese' },
  { value: 'japanese', label: 'Japanese' },
  { value: 'korean', label: 'Korean' },
  { value: 'western', label: 'Western' },
  { value: 'thai', label: 'Thai' },
  { value: 'indian', label: 'Indian' },
  { value: 'fast_food', label: 'Fast food' },
];

export const mealTypeOptions: Array<{ value: MealType; label: string }> = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
];

export const priceRangeOptions: Array<{ value: PriceRange; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

export const convenienceOptions: Array<{ value: Convenience; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

export interface RecommendationFormState {
  cuisine: Cuisine[];
  meal_type: MealType[];
  price_range: PriceRange[];
  convenience: Convenience[];
  only_from_favorite: boolean;
  extra_request: string;
}

export const initialRecommendationFormState: RecommendationFormState = {
  cuisine: [],
  meal_type: [],
  price_range: [],
  convenience: [],
  only_from_favorite: false,
  extra_request: '',
};

export const loadingSteps = [
  {
    title: 'Understanding your preferences',
    description: 'We are turning your selected tags and notes into a search query.',
  },
  {
    title: 'Searching the food pool',
    description: 'We are recalling the most relevant foods from your active collection.',
  },
  {
    title: 'Reranking the candidates',
    description: 'We are comparing the best matches and narrowing them down.',
  },
  {
    title: 'Writing recommendation reasons',
    description: 'We are drafting short explanations for the top results.',
  },
];

export const requiredFieldLabels = {
  cuisine: 'Cuisine',
  meal_type: 'Meal type',
  price_range: 'Price',
  convenience: 'Convenience',
} as const;

export function buildRecommendationPayload(
  form: RecommendationFormState,
): RecommendationRequest {
  return {
    cuisine: form.cuisine,
    meal_type: form.meal_type,
    price_range: form.price_range,
    convenience: form.convenience,
    only_from_favorite: form.only_from_favorite,
    extra_request: form.extra_request.trim() || null,
  };
}

export function getMissingRequiredSelections(
  form: RecommendationFormState,
): string[] {
  return (Object.entries(requiredFieldLabels) as Array<
    [keyof typeof requiredFieldLabels, string]
  >)
    .filter(([field]) => form[field].length === 0)
    .map(([, label]) => label);
}

export function formatDistance(value: number): string {
  return Number.isFinite(value) ? value.toFixed(4) : '-';
}

export function formatScore(value: number): string {
  return Number.isFinite(value) ? value.toFixed(4) : '-';
}

export function getLabels<TValue extends string>(
  selectedValues: Array<TValue | null | undefined>,
  options: Array<{ value: TValue; label: string }>,
): string[] {
  const optionMap = new Map(options.map((option) => [option.value, option.label]));
  return selectedValues
    .filter((value): value is TValue => Boolean(value))
    .map((value) => optionMap.get(value) ?? value);
}

export function formatPreferenceLabel(label: string, value: string): string {
  return `${label}: ${value}`;
}

export function getPreferenceSummaryChips(
  preference: RecommendationPreferenceSnapshot | RecommendationRequest,
): string[] {
  return [
    ...getLabels(preference.cuisine ?? [], cuisineOptions).map((value) =>
      formatPreferenceLabel('Cuisine', value),
    ),
    ...getLabels(preference.meal_type ?? [], mealTypeOptions).map((value) =>
      formatPreferenceLabel('Meal', value),
    ),
    ...getLabels(preference.price_range ?? [], priceRangeOptions).map((value) =>
      formatPreferenceLabel('Price', value),
    ),
    ...getLabels(preference.convenience ?? [], convenienceOptions).map((value) =>
      formatPreferenceLabel('Convenience', value),
    ),
  ];
}

export function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

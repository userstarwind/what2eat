import * as React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import LinearProgress from '@mui/material/LinearProgress';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  recommendFoodsApi,
  type RecommendationRequest,
  type RecommendationResponse,
} from '../data/recommand_server';
import useNotifications from '../hooks/useNotifications/useNotifications';
import PageContainer from './PageContainer';
import {
  convenienceOptions,
  cuisineOptions,
  formatDistance,
  formatScore,
  getLabels,
  loadingSteps,
  mealTypeOptions,
  priceRangeOptions,
  type RecommendationFormState,
} from '../recommendation/shared';

interface RecommendationResultLocationState {
  form?: RecommendationFormState;
  payload?: RecommendationRequest;
}

function appendExtraRequest(
  existingExtraRequest: string | null | undefined,
  nextExtraRequest: string,
): string | null {
  const normalizedExisting = existingExtraRequest?.trim() ?? '';
  const normalizedNext = nextExtraRequest.trim();

  if (!normalizedExisting && !normalizedNext) {
    return null;
  }

  if (!normalizedExisting) {
    return normalizedNext;
  }

  if (!normalizedNext) {
    return normalizedExisting;
  }

  if (normalizedExisting === normalizedNext) {
    return normalizedExisting;
  }

  return `${normalizedExisting}\n${normalizedNext}`;
}

function buildRecommendationFormState(
  form: RecommendationFormState | undefined,
  payload: RecommendationRequest | null,
): RecommendationFormState | undefined {
  if (!payload && !form) {
    return undefined;
  }

  return {
    cuisine: [...(payload?.cuisine ?? form?.cuisine ?? [])],
    meal_type: [...(payload?.meal_type ?? form?.meal_type ?? [])],
    price_range: [...(payload?.price_range ?? form?.price_range ?? [])],
    convenience: [...(payload?.convenience ?? form?.convenience ?? [])],
    only_from_favorite:
      payload?.only_from_favorite ?? form?.only_from_favorite ?? false,
    extra_request: payload?.extra_request ?? form?.extra_request ?? '',
  };
}

function formatSource(value: string): string {
  return value.replaceAll('_', ' ');
}

function getRecallRankLabel(mode: string, coarseRank: number): string {
  if (mode === 'rule') {
    return `Rule #${coarseRank}`;
  }
  if (mode === 'mixed') {
    return `Recall #${coarseRank}`;
  }
  return `Coarse #${coarseRank}`;
}

function getScoreChips(
  result: RecommendationResponse,
  item: RecommendationResponse['recommendations'][number],
): string[] {
  const chips = [getRecallRankLabel(result.diagnostics.recall_source, item.coarse_rank)];
  if (result.diagnostics.recall_source === 'rule') {
    chips.push(`Match ${formatScore(item.rerank_score)}`);
    return chips;
  }
  if (result.diagnostics.recall_source === 'mixed') {
    chips.push(`Recall score ${formatScore(1 - item.coarse_distance)}`);
  } else {
    chips.push(`Distance ${formatDistance(item.coarse_distance)}`);
  }
  if (result.diagnostics.rerank_source === 'external') {
    chips.push(`Rerank ${formatScore(item.rerank_score)}`);
  } else if (result.diagnostics.rerank_source === 'mixed') {
    chips.push(`Final score ${formatScore(item.rerank_score)}`);
  }
  return chips;
}

export default function RecommendationResult() {
  const navigate = useNavigate();
  const location = useLocation();
  const notifications = useNotifications();
  const state = (location.state as RecommendationResultLocationState | null) ?? null;
  const initialPayload = state?.payload ?? null;
  const initialForm = state?.form;

  const [requestPayload, setRequestPayload] = React.useState<RecommendationRequest | null>(
    initialPayload,
  );
  const [displayPayload, setDisplayPayload] = React.useState<RecommendationRequest | null>(
    initialPayload,
  );
  const [result, setResult] = React.useState<RecommendationResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(Boolean(initialPayload));
  const [loadingStepIndex, setLoadingStepIndex] = React.useState(0);
  const [extraRequestDraft, setExtraRequestDraft] = React.useState('');

  React.useEffect(() => {
    if (!requestPayload) {
      notifications.show(
        'Recommendation context is missing. Please go back and submit the form again.',
        {
          severity: 'warning',
          autoHideDuration: 4000,
        },
      );
      return;
    }

    let active = true;
    const currentPayload = requestPayload;

    const runRecommendation = async () => {
      setIsLoading(true);
      setLoadingStepIndex(0);

      try {
        const response = await recommendFoodsApi(currentPayload);
        if (!active) {
          return;
        }

        React.startTransition(() => {
          setResult(response);
          setDisplayPayload(currentPayload);
        });
        setExtraRequestDraft('');
        notifications.show(
          `Generated ${response.recommendations.length} recommendations from ${response.candidate_pool_size} candidate foods.`,
          {
            severity: 'success',
            autoHideDuration: 3000,
          },
        );
      } catch (error) {
        if (!active) {
          return;
        }

        notifications.show((error as Error).message, {
          severity: 'error',
          autoHideDuration: 4000,
        });
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    runRecommendation();
    return () => {
      active = false;
    };
  }, [notifications, requestPayload]);

  React.useEffect(() => {
    if (!isLoading) {
      setLoadingStepIndex(0);
      return undefined;
    }

    const timer = window.setInterval(() => {
      setLoadingStepIndex((current) =>
        current < loadingSteps.length - 1 ? current + 1 : current,
      );
    }, 1100);

    return () => window.clearInterval(timer);
  }, [isLoading]);

  const summaryPayload = displayPayload ?? requestPayload;
  const latestFormState = React.useMemo(
    () => buildRecommendationFormState(initialForm, summaryPayload),
    [initialForm, summaryPayload],
  );

  const selectedCuisineLabels = getLabels(
    summaryPayload?.cuisine ?? latestFormState?.cuisine ?? [],
    cuisineOptions,
  );
  const selectedMealTypeLabels = getLabels(
    summaryPayload?.meal_type ?? latestFormState?.meal_type ?? [],
    mealTypeOptions,
  );
  const selectedPriceLabels = getLabels(
    summaryPayload?.price_range ?? latestFormState?.price_range ?? [],
    priceRangeOptions,
  );
  const selectedConvenienceLabels = getLabels(
    summaryPayload?.convenience ?? latestFormState?.convenience ?? [],
    convenienceOptions,
  );
  const extraRequest =
    summaryPayload?.extra_request ?? latestFormState?.extra_request ?? '';
  const onlyFromFavorite =
    summaryPayload?.only_from_favorite ??
    latestFormState?.only_from_favorite ??
    false;
  const fallbackReasons = result?.diagnostics.fallback_reasons ?? [];
  const hasFallbackNotice = Boolean(
    result && result.diagnostics.recommendation_mode !== 'model',
  );

  const renderPreferenceGroup = React.useCallback(
    (label: string, values: string[], prefix?: string) => (
      <Stack spacing={0.75}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {values.map((value) => (
            <Chip
              key={`${label}-${value}`}
              size="small"
              label={prefix ? `${prefix} ${value}` : value}
              variant="outlined"
            />
          ))}
        </Stack>
      </Stack>
    ),
    [],
  );

  const handleBack = React.useCallback(() => {
    navigate('/home/recommend', {
      state: latestFormState ? { form: latestFormState } : undefined,
    });
  }, [latestFormState, navigate]);

  const handleRefreshBatch = React.useCallback(() => {
    if (!displayPayload || !result) {
      return;
    }

    const nextExcludedFoodIds = Array.from(
      new Set([
        ...(displayPayload.exclude_food_ids ?? []),
        ...result.recommendations.map((item) => item.food.id),
      ]),
    );
    const nextExtraRequest = appendExtraRequest(
      displayPayload.extra_request,
      extraRequestDraft,
    );

    if (nextExtraRequest && nextExtraRequest.length > 500) {
      notifications.show(
        'The combined extra request is too long. Please keep it within 500 characters.',
        {
          severity: 'warning',
          autoHideDuration: 4000,
        },
      );
      return;
    }

    setRequestPayload({
      ...displayPayload,
      extra_request: nextExtraRequest,
      exclude_food_ids: nextExcludedFoodIds,
    });
  }, [displayPayload, extraRequestDraft, notifications, result]);

  return (
    <PageContainer
      title="Recommendation Results"
      breadcrumbs={[
        { title: 'Recommendations', path: '/home/recommend' },
        { title: 'Results' },
      ]}
    >
      <Stack spacing={2} sx={{ width: '100%' }}>
        {summaryPayload ? (
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={1.75}>
                <Typography variant="subtitle2">Your selected preferences</Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    {renderPreferenceGroup('Cuisine', selectedCuisineLabels)}
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    {renderPreferenceGroup('Meal type', selectedMealTypeLabels)}
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    {renderPreferenceGroup('Price', selectedPriceLabels, 'Price')}
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    {renderPreferenceGroup(
                      'Convenience',
                      selectedConvenienceLabels,
                      'Convenience',
                    )}
                  </Grid>
                </Grid>
                {onlyFromFavorite ? (
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip
                      size="small"
                      label="Only choose from my favorites"
                      color="primary"
                      variant="outlined"
                    />
                  </Stack>
                ) : null}
                {extraRequest ? (
                  <Box
                    sx={{
                      px: 1.5,
                      py: 1.25,
                      borderRadius: 1.5,
                      bgcolor: 'action.hover',
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      Current extra request
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.25, whiteSpace: 'pre-wrap' }}>
                      {extraRequest}
                    </Typography>
                  </Box>
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        ) : null}

        {!requestPayload ? (
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={1.5}>
                <Typography variant="subtitle2">Nothing to generate yet</Typography>
                <Typography variant="body2" color="text.secondary">
                  Go back to the recommendation form, choose your preferences, and start again.
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Card variant="outlined">
                <CardContent>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="overline" color="text.secondary">
                        Recommendation in progress
                      </Typography>
                      <Typography variant="h6">
                        {loadingSteps[loadingStepIndex]?.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {loadingSteps[loadingStepIndex]?.description}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={((loadingStepIndex + 1) / loadingSteps.length) * 100}
                    />
                    <List dense disablePadding>
                      {loadingSteps.map((step, index) => (
                        <ListItem key={step.title} disableGutters>
                          <ListItemIcon sx={{ minWidth: 32 }}>
                            {index < loadingStepIndex ? (
                              <CheckCircleRoundedIcon color="success" fontSize="small" />
                            ) : index === loadingStepIndex ? (
                              <AutoAwesomeRoundedIcon color="primary" fontSize="small" />
                            ) : (
                              <MoreHorizRoundedIcon color="disabled" fontSize="small" />
                            )}
                          </ListItemIcon>
                          <ListItemText
                            primary={step.title}
                            secondary={index === loadingStepIndex ? step.description : undefined}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 8 }}>
              <Stack spacing={2}>
                {[1, 2, 3].map((item) => (
                  <Card key={item} variant="outlined">
                    <CardContent>
                      <Stack spacing={2}>
                        <Skeleton variant="text" width="40%" height={36} />
                        <Skeleton variant="text" width="65%" />
                        <Stack direction="row" spacing={1}>
                          <Skeleton variant="rounded" width={84} height={28} />
                          <Skeleton variant="rounded" width={84} height={28} />
                          <Skeleton variant="rounded" width={96} height={28} />
                        </Stack>
                        <Skeleton variant="rounded" height={80} />
                        <Stack direction="row" justifyContent="space-between">
                          <Skeleton variant="rounded" width={96} height={40} />
                          <Skeleton variant="rounded" width={120} height={40} />
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Grid>
          </Grid>
        ) : result ? (
          <Grid container spacing={2}>
            {hasFallbackNotice ? (
              <Grid size={{ xs: 12 }}>
                <Alert severity="info">
                  Generated with {formatSource(result.diagnostics.recommendation_mode)} mode:
                  recall used {formatSource(result.diagnostics.recall_source)}, ranking used{' '}
                  {formatSource(result.diagnostics.rerank_source)}, and reasons used{' '}
                  {formatSource(result.diagnostics.reason_source)}.
                  {fallbackReasons.length ? ` ${fallbackReasons.join(' ')}` : ''}
                </Alert>
              </Grid>
            ) : null}
            <Grid size={{ xs: 12, md: 4 }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="overline" color="text.secondary">
                    Candidate pool
                  </Typography>
                  <Typography variant="h4">{result.candidate_pool_size}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="overline" color="text.secondary">
                    Coarse recall top K
                  </Typography>
                  <Typography variant="h4">{result.coarse_top_k}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="overline" color="text.secondary">
                    Final recommendations
                  </Typography>
                  <Typography variant="h4">{result.final_top_k}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Stack spacing={2}>
                {result.recommendations.map((item, index) => (
                  <Card key={item.food.id} variant="outlined">
                    <CardContent>
                      <Stack spacing={2}>
                        <Stack
                          direction={{ xs: 'column', md: 'row' }}
                          spacing={2}
                          justifyContent="space-between"
                        >
                          <Box>
                            <Typography variant="h6">{`${index + 1}. ${item.food.name}`}</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                              {item.food.description || 'No description provided.'}
                            </Typography>
                          </Box>
                          <Stack direction="row" spacing={1} flexWrap="wrap">
                            {getScoreChips(result, item).map((label) => (
                              <Chip key={label} size="small" label={label} />
                            ))}
                          </Stack>
                        </Stack>

                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          {item.food.cuisine ? <Chip size="small" label={item.food.cuisine} /> : null}
                          {item.food.meal_type ? (
                            <Chip size="small" label={item.food.meal_type} />
                          ) : null}
                          <Chip size="small" label={`price ${item.food.price_range}`} />
                          <Chip size="small" label={`convenience ${item.food.convenience}`} />
                        </Stack>

                        <Box
                          sx={{
                            px: 1.5,
                            py: 1.25,
                            borderRadius: 1.5,
                            bgcolor: 'action.hover',
                          }}
                        >
                          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                            Why this is recommended
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {item.reason}
                          </Typography>
                        </Box>

                        <Stack direction="row" justifyContent="flex-end">
                          <Button
                            variant="outlined"
                            startIcon={<VisibilityRoundedIcon />}
                            onClick={() => navigate(`/home/all/${item.food.id}`)}
                          >
                            View food
                          </Button>
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Card variant="outlined">
                <CardContent>
                  <Stack spacing={1.5}>
                    <Box>
                      <Typography variant="subtitle2">Want another batch?</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        We will keep your current preference settings, exclude the foods already
                        shown in this batch, and optionally append another extra request before
                        generating the next set.
                      </Typography>
                    </Box>
                    <TextField
                      fullWidth
                      size="small"
                      multiline
                      minRows={2}
                      maxRows={5}
                      label="Add more for the next batch"
                      value={extraRequestDraft}
                      onChange={(event) => setExtraRequestDraft(event.target.value)}
                      placeholder="For example: less spicy, more soup, something lighter, suitable for a late dinner..."
                    />
                    <Typography variant="body2" color="text.secondary">
                      The next request will exclude {result.recommendations.length} foods from the
                      current batch.
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Stack direction="row" justifyContent="space-between" spacing={2}>
                <Button
                  variant="outlined"
                  color="secondary"
                  startIcon={<ArrowBackRoundedIcon />}
                  onClick={handleBack}
                >
                  Back
                </Button>
                <Button
                  variant="outlined"
                  color="secondary"
                  startIcon={<RefreshRoundedIcon />}
                  onClick={handleRefreshBatch}
                  disabled={isLoading}
                >
                  Swap batch
                </Button>
              </Stack>
            </Grid>
          </Grid>
        ) : (
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={1.5}>
                <Typography variant="subtitle2">No results yet</Typography>
                <Typography variant="body2" color="text.secondary">
                  Go back and try another combination of preferences.
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        )}
      </Stack>
    </PageContainer>
  );
}

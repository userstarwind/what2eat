import * as React from 'react';
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
import Typography from '@mui/material/Typography';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  recommendFoodsApi,
  type RecommendationRequest,
  type RecommendationResponse,
} from '../data/recommand_server';
import useNotifications from '../hooks/useNotifications/useNotifications';
import PageContainer from '../components/PageContainer';
import {
  formatDistance,
  formatScore,
  convenienceOptions,
  cuisineOptions,
  loadingSteps,
  mealTypeOptions,
  priceRangeOptions,
  type RecommendationFormState,
} from './recommendationShared';

interface RecommendationResultLocationState {
  form?: RecommendationFormState;
  payload?: RecommendationRequest;
}

function getLabels<TValue extends string>(
  selectedValues: TValue[],
  options: Array<{ value: TValue; label: string }>,
): string[] {
  const optionMap = new Map(options.map((option) => [option.value, option.label]));
  return selectedValues.map((value) => optionMap.get(value) ?? value);
}

export default function RecommendationResultPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const notifications = useNotifications();
  const state = (location.state as RecommendationResultLocationState | null) ?? null;
  const payload = state?.payload;
  const form = state?.form;

  const [result, setResult] = React.useState<RecommendationResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(Boolean(payload));
  const [loadingStepIndex, setLoadingStepIndex] = React.useState(0);

  React.useEffect(() => {
    if (!payload) {
      notifications.show('Recommendation context is missing. Please go back and submit the form again.', {
        severity: 'warning',
        autoHideDuration: 4000,
      });
      return;
    }

    let active = true;
    const runRecommendation = async () => {
      setIsLoading(true);
      setLoadingStepIndex(0);
      try {
        const response = await recommendFoodsApi(payload);
        if (!active) {
          return;
        }
        React.startTransition(() => {
          setResult(response);
        });
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
  }, [notifications, payload]);

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

  const handleBack = React.useCallback(() => {
    navigate('/home/recommend', { state: form ? { form } : undefined });
  }, [form, navigate]);

  const selectedCuisineLabels = getLabels(
    form?.cuisine ?? payload?.cuisine ?? [],
    cuisineOptions,
  );
  const selectedMealTypeLabels = getLabels(
    form?.meal_type ?? payload?.meal_type ?? [],
    mealTypeOptions,
  );
  const selectedPriceLabels = getLabels(
    form?.price_range ?? payload?.price_range ?? [],
    priceRangeOptions,
  );
  const selectedConvenienceLabels = getLabels(
    form?.convenience ?? payload?.convenience ?? [],
    convenienceOptions,
  );
  const extraRequest = form?.extra_request ?? payload?.extra_request ?? '';
  const onlyFromFavorite = form?.only_from_favorite ?? payload?.only_from_favorite ?? false;

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

  return (
    <PageContainer
      title="Generating Recommendations"
      breadcrumbs={[
        { title: 'Recommendations', path: '/home/recommend' },
        { title: 'Results' },
      ]}
    >
      <Stack spacing={2} sx={{ width: '100%' }}>
        {payload ? (
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
                      Extra request
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.25 }}>
                      {extraRequest}
                    </Typography>
                  </Box>
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        ) : null}

        {!payload ? (
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
                            <Chip size="small" label={`Coarse #${item.coarse_rank}`} />
                            <Chip
                              size="small"
                              label={`Distance ${formatDistance(item.coarse_distance)}`}
                            />
                            <Chip
                              size="small"
                              label={`Rerank ${formatScore(item.rerank_score)}`}
                            />
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
              <Stack direction="row" justifyContent="flex-start">
                <Button
                  variant="outlined"
                  startIcon={<ArrowBackRoundedIcon />}
                  onClick={handleBack}
                >
                  Back
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

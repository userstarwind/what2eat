import * as React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import { useNavigate, useParams } from 'react-router-dom';
import PageContainer from './PageContainer';
import {
  getRecommendationHistoryApi,
  type RecommendationDiagnosticsSnapshot,
  type RecommendationHistoryItem,
  type RecommendationHistoryRead,
} from '../data/history_server';
import {
  formatPreferenceLabel,
  formatDistance,
  formatScore,
  formatTimestamp,
  getLabels,
  cuisineOptions,
  mealTypeOptions,
  priceRangeOptions,
  convenienceOptions,
} from '../recommendation/shared';

function formatSource(value: string): string {
  return value.replaceAll('_', ' ');
}

function getRecallRankLabel(
  diagnostics: RecommendationDiagnosticsSnapshot | null,
  coarseRank: number,
): string {
  if (diagnostics?.recall_source === 'rule') {
    return `Rule #${coarseRank}`;
  }
  if (diagnostics?.recall_source === 'mixed') {
    return `Recall #${coarseRank}`;
  }
  return `Coarse #${coarseRank}`;
}

function getScoreChips(
  diagnostics: RecommendationDiagnosticsSnapshot | null,
  item: RecommendationHistoryItem,
): string[] {
  const chips = [getRecallRankLabel(diagnostics, item.coarse_rank)];
  if (diagnostics?.recall_source === 'rule') {
    chips.push(`Match ${formatScore(item.rerank_score)}`);
    return chips;
  }
  if (diagnostics?.recall_source === 'mixed') {
    chips.push(`Recall score ${formatScore(1 - item.coarse_distance)}`);
  } else {
    chips.push(`Distance ${formatDistance(item.coarse_distance)}`);
  }
  if (diagnostics?.rerank_source === 'external') {
    chips.push(`Rerank ${formatScore(item.rerank_score)}`);
  } else if (diagnostics?.rerank_source === 'mixed') {
    chips.push(`Final score ${formatScore(item.rerank_score)}`);
  }
  return chips;
}

export default function RecommendationHistoryShow() {
  const navigate = useNavigate();
  const { historyId } = useParams();
  const [history, setHistory] = React.useState<RecommendationHistoryRead | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  const loadHistory = React.useCallback(async () => {
    if (!historyId) {
      setError(new Error('History id is required.'));
      setIsLoading(false);
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      const response = await getRecommendationHistoryApi(historyId);
      setHistory(response);
    } catch (loadError) {
      setError(loadError as Error);
    } finally {
      setIsLoading(false);
    }
  }, [historyId]);

  React.useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const pageTitle = history ? `History ${formatTimestamp(history.created_at)}` : 'History detail';
  const preferenceRows = history
    ? [
        formatPreferenceLabel(
          'Cuisine',
          getLabels(history.preference_snapshot.cuisine, cuisineOptions).join(', ') || '-',
        ),
        formatPreferenceLabel(
          'Meal type',
          getLabels(history.preference_snapshot.meal_type, mealTypeOptions).join(', ') || '-',
        ),
        formatPreferenceLabel(
          'Price range',
          getLabels(history.preference_snapshot.price_range, priceRangeOptions).join(', ') || '-',
        ),
        formatPreferenceLabel(
          'Convenience',
          getLabels(history.preference_snapshot.convenience, convenienceOptions).join(', ') || '-',
        ),
        formatPreferenceLabel(
          'Scope',
          history.preference_snapshot.only_from_favorite
            ? 'Favorites only'
            : 'All active foods',
        ),
      ]
    : [];

  let content: React.ReactNode = null;
  if (isLoading) {
    content = (
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
        }}
      >
        <CircularProgress />
      </Box>
    );
  } else if (error) {
    content = <Alert severity="error">{error.message}</Alert>;
  } else if (history) {
    const diagnostics = history.diagnostics_snapshot;
    const fallbackReasons = diagnostics?.fallback_reasons ?? [];
    const hasFallbackNotice = Boolean(
      diagnostics && diagnostics.recommendation_mode !== 'model',
    );

    content = (
      <Box sx={{ flexGrow: 1, width: '100%' }}>
        <Grid container spacing={2} sx={{ width: '100%' }}>
          {hasFallbackNotice && diagnostics ? (
            <Grid size={{ xs: 12 }}>
              <Alert severity="info">
                Generated with {formatSource(diagnostics.recommendation_mode)} mode:
                recall used {formatSource(diagnostics.recall_source)}, ranking used{' '}
                {formatSource(diagnostics.rerank_source)}, and reasons used{' '}
                {formatSource(diagnostics.reason_source)}.
                {fallbackReasons.length ? ` ${fallbackReasons.join(' ')}` : ''}
              </Alert>
            </Grid>
          ) : null}
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="overline">Recommended at</Typography>
                <Typography variant="body1" sx={{ mb: 1 }}>
                  {formatTimestamp(history.created_at)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="overline">Candidate pool</Typography>
                <Typography variant="body1" sx={{ mb: 1 }}>
                  {history.candidate_pool_size}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="overline">Saved recommendations</Typography>
                <Typography variant="body1" sx={{ mb: 1 }}>
                  {history.recommendations.length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="overline">Coarse recall top K</Typography>
                <Typography variant="body1" sx={{ mb: 1 }}>
                  {history.coarse_top_k}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="overline">Final top K</Typography>
                <Typography variant="body1" sx={{ mb: 1 }}>
                  {history.final_top_k}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="overline">Preference snapshot</Typography>
                <Grid container spacing={2} sx={{ mt: 0.25 }}>
                  {preferenceRows.map((row) => (
                    <Grid key={row} size={{ xs: 12, sm: 6 }}>
                      <Chip size="small" variant="outlined" label={row} />
                    </Grid>
                  ))}
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="caption" color="text.secondary">
                      Extra request
                    </Typography>
                    <Typography
                      variant="body1"
                      sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}
                      color={history.preference_snapshot.extra_request ? 'text.primary' : 'text.secondary'}
                    >
                      {history.preference_snapshot.extra_request || 'No extra request.'}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Stack spacing={2}>
              {history.recommendations.map((item) => (
                <Card key={item.id} variant="outlined">
                  <CardContent>
                    <Stack spacing={2}>
                      <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={2}
                        justifyContent="space-between"
                      >
                        <Box>
                          <Typography variant="h6">{`${item.rank}. ${item.food_snapshot.name}`}</Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {item.food_snapshot.description || 'No description provided.'}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          {getScoreChips(history.diagnostics_snapshot, item).map((label) => (
                            <Chip key={label} size="small" label={label} />
                          ))}
                        </Stack>
                      </Stack>

                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {item.food_snapshot.cuisine ? (
                          <Chip size="small" label={item.food_snapshot.cuisine} />
                        ) : null}
                        {item.food_snapshot.meal_type ? (
                          <Chip size="small" label={item.food_snapshot.meal_type} />
                        ) : null}
                        <Chip size="small" label={`price ${item.food_snapshot.price_range}`} />
                        <Chip size="small" label={`convenience ${item.food_snapshot.convenience}`} />
                        {item.food_snapshot.is_favorite ? (
                          <Chip size="small" color="primary" variant="outlined" label="Favorite at save time" />
                        ) : null}
                      </Stack>

                      <Card variant="outlined" sx={{ bgcolor: 'action.hover' }}>
                        <CardContent>
                          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                            Why this was recommended
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {item.reason}
                          </Typography>
                        </CardContent>
                      </Card>

                      {item.food_id ? (
                        <Stack direction="row" justifyContent="flex-end">
                          <Button
                            variant="outlined"
                            startIcon={<VisibilityRoundedIcon />}
                            onClick={() => navigate(`/home/all/${item.food_id}`)}
                          >
                            View current food
                          </Button>
                        </Stack>
                      ) : null}
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </Grid>
        </Grid>
      </Box>
    );
  }

  return (
    <PageContainer
      title={pageTitle}
      breadcrumbs={[
        { title: 'Recommendation history', path: '/home/history' },
        { title: pageTitle },
      ]}
      actions={
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/home/history')}
          >
            Back
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => void loadHistory()}
            disabled={isLoading}
          >
            Refresh
          </Button>
        </Stack>
      }
    >
      <Box sx={{ display: 'flex', flex: 1, width: '100%' }}>{content}</Box>
    </PageContainer>
  );
}

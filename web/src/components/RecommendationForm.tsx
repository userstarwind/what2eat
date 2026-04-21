import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { useLocation, useNavigate } from 'react-router-dom';
import useNotifications from '../hooks/useNotifications/useNotifications';
import PageContainer from './PageContainer';
import {
  buildRecommendationPayload,
  convenienceOptions,
  cuisineOptions,
  getMissingRequiredSelections,
  initialRecommendationFormState,
  mealTypeOptions,
  priceRangeOptions,
  type RecommendationFormState,
} from '../recommendation/shared';

export default function RecommendationForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const notifications = useNotifications();
  const [form, setForm] = React.useState<RecommendationFormState>(() => {
    const state = location.state as { form?: RecommendationFormState } | null;
    return state?.form ?? initialRecommendationFormState;
  });
  const missingRequiredSelections = React.useMemo(
    () => getMissingRequiredSelections(form),
    [form],
  );
  const isFormValid = missingRequiredSelections.length === 0;

  const handleMultiToggle = <
    TField extends 'cuisine' | 'meal_type' | 'price_range' | 'convenience',
    TValue extends RecommendationFormState[TField][number],
  >(
    field: TField,
    value: TValue,
  ) => {
    setForm((current) => {
      const currentValues = current[field] as TValue[];
      const nextValues = currentValues.includes(value)
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value];
      return {
        ...current,
        [field]: nextValues,
      };
    });
  };

  const handleTextChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleFavoriteToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((current) => ({
      ...current,
      only_from_favorite: event.target.checked,
    }));
  };

  const handleReset = () => {
    setForm(initialRecommendationFormState);
  };

  const renderOptionRow = <
    TValue extends string,
  >(
    label: string,
    field: 'cuisine' | 'meal_type' | 'price_range' | 'convenience',
    options: Array<{ value: TValue; label: string }>,
  ) => (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="subtitle2">{label}</Typography>
        <Typography variant="caption" color="error">
          Required
        </Typography>
      </Stack>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {options.map((option) => {
          const selected = (form[field] as string[]).includes(option.value);
          return (
            <Chip
              key={option.value}
              label={option.label}
              clickable
              color={selected ? 'primary' : 'default'}
              variant={selected ? 'filled' : 'outlined'}
              onClick={() => handleMultiToggle(field, option.value as never)}
            />
          );
        })}
      </Stack>
      {(form[field] as string[]).length === 0 ? (
        <Typography variant="caption" color="error">
          Select at least one {label.toLowerCase()} option.
        </Typography>
      ) : null}
    </Stack>
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isFormValid) {
      notifications.show(
        `Please select at least one option for: ${missingRequiredSelections.join(', ')}.`,
        {
          severity: 'warning',
          autoHideDuration: 4000,
        },
      );
      return;
    }
    navigate('/home/recommend/results', {
      state: { form, payload: buildRecommendationPayload(form) },
    });
  };

  return (
    <PageContainer
      title="Recommendations"
      breadcrumbs={[{ title: 'Recommendations' }]}
      actions={
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<RefreshRoundedIcon />}
            onClick={handleReset}
          >
            Reset
          </Button>
          <Button
            type="submit"
            form="recommendation-form"
            variant="contained"
            startIcon={<AutoAwesomeRoundedIcon />}
            disabled={!isFormValid}
          >
            Recommend
          </Button>
        </Stack>
      }
    >
      <Stack spacing={2} sx={{ width: '100%' }}>
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Box>
                <Typography variant="h6">Describe what you want</Typography>
                <Typography variant="body2" color="text.secondary">
                  We will use your preference form to recall candidate foods, rerank
                  them, and return the top matches with reasons.
                </Typography>
              </Box>
              {!isFormValid ? (
                <Typography variant="body2" color="text.secondary">
                  Select at least one option in each required section before generating recommendations.
                </Typography>
              ) : null}
              <Box component="form" id="recommendation-form" onSubmit={handleSubmit}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12 }}>
                    {renderOptionRow('Cuisine', 'cuisine', cuisineOptions)}
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    {renderOptionRow('Meal type', 'meal_type', mealTypeOptions)}
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    {renderOptionRow('Price', 'price_range', priceRangeOptions)}
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    {renderOptionRow('Convenience', 'convenience', convenienceOptions)}
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      fullWidth
                      size="small"
                      multiline
                      minRows={3}
                      maxRows={6}
                      label="Extra request"
                      name="extra_request"
                      value={form.extra_request}
                      onChange={handleTextChange}
                      placeholder="For example: spicy, warm soup, not too oily, quick lunch, suitable for rainy weather..."
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={form.only_from_favorite}
                          onChange={handleFavoriteToggle}
                        />
                      }
                      label="Only choose from my favorites"
                    />
                  </Grid>
                </Grid>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={0.75}>
              <Typography variant="subtitle2">Ready to generate</Typography>
              <Typography variant="body2" color="text.secondary">
                Choose your tags, add any extra request, and then move to the next page to generate recommendations.
                The backend needs at least 30 eligible foods in the candidate pool before it can return results.
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </PageContainer>
  );
}

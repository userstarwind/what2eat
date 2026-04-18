import * as React from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useNavigate } from 'react-router-dom';
import {
  type Convenience,
  type Cuisine,
  type MealType,
  type PriceRange,
} from '../data/food_server';

export interface FoodFormValues {
  name: string;
  description: string;
  cuisine: Cuisine | '';
  meal_type: MealType | '';
  price_range: PriceRange;
  convenience: Convenience;
}

export interface FoodFormState {
  values: FoodFormValues;
  errors: Partial<Record<keyof FoodFormValues, string>>;
}

interface FoodFormProps {
  formState: FoodFormState;
  onFieldChange: <TField extends keyof FoodFormValues>(
    name: TField,
    value: FoodFormValues[TField],
  ) => void;
  onSubmit: (formValues: FoodFormValues) => Promise<void>;
  submitButtonLabel: string;
  backButtonPath: string;
}

const CUISINE_OPTIONS: Array<{ value: Cuisine; label: string }> = [
  { value: 'chinese', label: 'Chinese' },
  { value: 'japanese', label: 'Japanese' },
  { value: 'korean', label: 'Korean' },
  { value: 'western', label: 'Western' },
  { value: 'thai', label: 'Thai' },
  { value: 'indian', label: 'Indian' },
  { value: 'fast_food', label: 'Fast Food' },
];

const MEAL_TYPE_OPTIONS: Array<{ value: MealType; label: string }> = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
];

const PRICE_RANGE_OPTIONS: Array<{ value: PriceRange; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const CONVENIENCE_OPTIONS: Array<{ value: Convenience; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

export default function FoodForm({
  formState,
  onFieldChange,
  onSubmit,
  submitButtonLabel,
  backButtonPath,
}: FoodFormProps) {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = React.useCallback(
    async (event: React.SyntheticEvent<HTMLFormElement, SubmitEvent>) => {
      event.preventDefault();
      setIsSubmitting(true);
      try {
        await onSubmit(formState.values);
      } finally {
        setIsSubmitting(false);
      }
    },
    [formState.values, onSubmit],
  );

  const handleBack = React.useCallback(() => {
    navigate(backButtonPath);
  }, [backButtonPath, navigate]);

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate sx={{ width: '100%' }}>
      <Stack spacing={2}>
        <TextField
          label="Name"
          name="name"
          value={formState.values.name}
          onChange={(event) => onFieldChange('name', event.target.value)}
          error={!!formState.errors.name}
          helperText={formState.errors.name ?? ' '}
          fullWidth
          required
        />
        <TextField
          label="Description"
          name="description"
          value={formState.values.description}
          onChange={(event) => onFieldChange('description', event.target.value)}
          error={!!formState.errors.description}
          helperText={formState.errors.description ?? ' '}
          fullWidth
          multiline
          minRows={4}
        />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            select
            fullWidth
            label="Cuisine"
            value={formState.values.cuisine}
            onChange={(event) => onFieldChange('cuisine', event.target.value as Cuisine | '')}
          >
            <MenuItem value="">None</MenuItem>
            {CUISINE_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            fullWidth
            label="Meal type"
            value={formState.values.meal_type}
            onChange={(event) => onFieldChange('meal_type', event.target.value as MealType | '')}
          >
            <MenuItem value="">None</MenuItem>
            {MEAL_TYPE_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            select
            fullWidth
            label="Price range"
            value={formState.values.price_range}
            onChange={(event) => onFieldChange('price_range', event.target.value as PriceRange)}
          >
            {PRICE_RANGE_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            fullWidth
            label="Convenience"
            value={formState.values.convenience}
            onChange={(event) =>
              onFieldChange('convenience', event.target.value as Convenience)
            }
          >
            {CONVENIENCE_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
        <Stack direction="row" spacing={2} justifyContent="space-between">
          <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={handleBack}>
            Back
          </Button>
          <Button type="submit" variant="contained" loading={isSubmitting}>
            {submitButtonLabel}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import { useLocation, useNavigate } from 'react-router-dom';
import { createFoodApi } from '../data/food_server';
import useNotifications from '../hooks/useNotifications/useNotifications';
import PageContainer from './PageContainer';
import FoodForm, { type FoodFormState, type FoodFormValues } from './FoodForm';

function getSectionBasePath(pathname: string): string {
  if (pathname.startsWith('/home/favorites')) {
    return '/home/favorites';
  }
  return '/home/all';
}

const INITIAL_FORM_VALUES: FoodFormValues = {
  name: '',
  description: '',
  cuisine: '',
  meal_type: '',
  price_range: 'medium',
  convenience: 'medium',
};

export default function FoodCreate() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const notifications = useNotifications();
  const sectionBasePath = React.useMemo(() => getSectionBasePath(pathname), [pathname]);
  const sectionTitle = pathname.startsWith('/home/favorites')
    ? 'Favorite foods'
    : 'All foods';

  const [error, setError] = React.useState<Error | null>(null);
  const [formState, setFormState] = React.useState<FoodFormState>({
    values: INITIAL_FORM_VALUES,
    errors: {},
  });

  const handleFieldChange = React.useCallback(
    <TField extends keyof FoodFormValues>(name: TField, value: FoodFormValues[TField]) => {
      setFormState((previous) => ({
        values: {
          ...previous.values,
          [name]: value,
        },
        errors: {
          ...previous.errors,
          [name]:
            name === 'name' && typeof value === 'string' && !value.trim()
              ? 'Name is required.'
              : undefined,
        },
      }));
    },
    [],
  );

  const handleSubmit = React.useCallback(
    async (formValues: FoodFormValues) => {
      const name = formValues.name.trim();
      if (!name) {
        setFormState((previous) => ({
          ...previous,
          errors: {
            ...previous.errors,
            name: 'Name is required.',
          },
        }));
        return;
      }

      setError(null);
      const createdFood = await createFoodApi({
        name,
        description: formValues.description.trim() || null,
        cuisine: formValues.cuisine || null,
        meal_type: formValues.meal_type || null,
        price_range: formValues.price_range,
        convenience: formValues.convenience,
      });

      notifications.show('Food created successfully.', {
        severity: 'success',
        autoHideDuration: 3000,
      });
      navigate(`${sectionBasePath}/${createdFood.id}`);
    },
    [navigate, notifications, sectionBasePath],
  );

  return (
    <PageContainer
      title="Create food"
      breadcrumbs={[
        { title: sectionTitle, path: sectionBasePath },
        { title: 'Create' },
      ]}
    >
      <Box sx={{ display: 'flex', flex: 1, width: '100%' }}>
        <Box sx={{ width: '100%', maxWidth: 720 }}>
          {error ? <Alert severity="error">{error.message}</Alert> : null}
          <FoodForm
            formState={formState}
            onFieldChange={handleFieldChange}
            onSubmit={handleSubmit}
            submitButtonLabel="Create"
            backButtonPath={sectionBasePath}
          />
        </Box>
      </Box>
    </PageContainer>
  );
}

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { editFoodApi, getFoodApi } from '../data/food_server';
import useNotifications from '../hooks/useNotifications/useNotifications';
import PageContainer from './PageContainer';
import FoodForm, { type FoodFormState, type FoodFormValues } from './FoodForm';

function getSectionBasePath(pathname: string): string {
  if (pathname.startsWith('/home/favorites')) {
    return '/home/favorites';
  }
  return '/home/all';
}

const EMPTY_FORM_VALUES: FoodFormValues = {
  name: '',
  description: '',
  cuisine: '',
  meal_type: '',
  price_range: 'medium',
  convenience: 'medium',
};

export default function FoodEdit() {
  const { pathname } = useLocation();
  const { foodId } = useParams();
  const navigate = useNavigate();
  const notifications = useNotifications();
  const sectionBasePath = React.useMemo(() => getSectionBasePath(pathname), [pathname]);
  const sectionTitle = pathname.startsWith('/home/favorites')
    ? 'Favorite foods'
    : 'All foods';

  const [formState, setFormState] = React.useState<FoodFormState>({
    values: EMPTY_FORM_VALUES,
    errors: {},
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const foodTitle = formState.values.name.trim() || 'Food details';
  const pageTitle = `Edit ${foodTitle}`;

  React.useEffect(() => {
    if (!foodId) {
      setError(new Error('Food id is required.'));
      setIsLoading(false);
      return;
    }

    let active = true;

    const loadFood = async () => {
      setError(null);
      setIsLoading(true);
      try {
        const food = await getFoodApi(foodId);
        if (!active) {
          return;
        }
        setFormState({
          values: {
            name: food.name,
            description: food.description ?? '',
            cuisine: food.cuisine ?? '',
            meal_type: food.meal_type ?? '',
            price_range: food.price_range,
            convenience: food.convenience,
          },
          errors: {},
        });
      } catch (loadError) {
        if (active) {
          setError(loadError as Error);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    loadFood();
    return () => {
      active = false;
    };
  }, [foodId]);

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
      if (!foodId) {
        return;
      }
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
      await editFoodApi(foodId, {
        name,
        description: formValues.description.trim() || null,
        cuisine: formValues.cuisine || null,
        meal_type: formValues.meal_type || null,
        price_range: formValues.price_range,
        convenience: formValues.convenience,
      });
      notifications.show('Food updated successfully.', {
        severity: 'success',
        autoHideDuration: 3000,
      });
      navigate(`${sectionBasePath}/${foodId}`);
    },
    [foodId, navigate, notifications, sectionBasePath],
  );

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
  } else {
    content = (
      <Box sx={{ width: '100%', maxWidth: 720 }}>
        <FoodForm
          formState={formState}
          onFieldChange={handleFieldChange}
          onSubmit={handleSubmit}
          submitButtonLabel="Save"
          backButtonPath={`${sectionBasePath}/${foodId}`}
        />
      </Box>
    );
  }

  return (
    <PageContainer
      title={pageTitle}
      breadcrumbs={[
        { title: sectionTitle, path: sectionBasePath },
        { title: foodTitle, path: `${sectionBasePath}/${foodId}` },
        { title: 'Edit' },
      ]}
    >
      <Box sx={{ display: 'flex', flex: 1, width: '100%' }}>{content}</Box>
    </PageContainer>
  );
}

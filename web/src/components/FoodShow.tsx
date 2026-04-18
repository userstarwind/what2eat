import * as React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditIcon from '@mui/icons-material/Edit';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import dayjs from 'dayjs';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  activateFoodApi,
  deactivateFoodApi,
  deleteFoodApi,
  favoriteFoodApi,
  getFoodApi,
  restoreFoodApi,
  recycleFoodApi,
  unfavoriteFoodApi,
  type FoodReadResp,
} from '../data/food_server';
import { useDialogs } from '../hooks/useDialogs/useDialogs';
import useNotifications from '../hooks/useNotifications/useNotifications';
import PageContainer from './PageContainer';

function getSectionBasePath(pathname: string): string {
  if (pathname.startsWith('/home/favorites')) {
    return '/home/favorites';
  }
  if (pathname.startsWith('/home/recycle')) {
    return '/home/recycle';
  }
  return '/home/all';
}

function getStatusColor(
  food: FoodReadResp,
): 'default' | 'success' | 'info' | 'warning' | 'error' {
  if (food.is_recycled) {
    return 'error';
  }
  if (food.status === 'active') {
    return 'success';
  }
  if (food.status === 'inactive') {
    return 'default';
  }
  if (food.status === 'failed') {
    return 'error';
  }
  return 'warning';
}

function getStatusLabel(food: FoodReadResp): string {
  if (food.is_recycled) {
    return 'Recycled';
  }
  if (food.status === 'active') {
    return 'Active';
  }
  if (food.status === 'inactive') {
    return 'Inactive';
  }
  if (food.status === 'processing') {
    return 'Processing';
  }
  if (food.status === 'failed') {
    return 'Failed';
  }
  return 'Waiting for processing';
}

function canToggleActive(food: FoodReadResp): boolean {
  return !food.is_recycled && (food.status === 'active' || food.status === 'inactive');
}

export default function FoodShow() {
  const { pathname } = useLocation();
  const { foodId } = useParams();
  const navigate = useNavigate();
  const dialogs = useDialogs();
  const notifications = useNotifications();
  const sectionBasePath = React.useMemo(() => getSectionBasePath(pathname), [pathname]);
  const sectionTitle =
    pathname.startsWith('/home/favorites')
      ? 'Favorite foods'
      : pathname.startsWith('/home/recycle')
        ? 'Recycled foods'
        : 'All foods';

  const [food, setFood] = React.useState<FoodReadResp | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const pageTitle = food?.name ?? 'Food details';

  const loadFood = React.useCallback(async () => {
    if (!foodId) {
      setError(new Error('Food id is required.'));
      setIsLoading(false);
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      const response = await getFoodApi(foodId);
      setFood(response);
    } catch (loadError) {
      setError(loadError as Error);
    } finally {
      setIsLoading(false);
    }
  }, [foodId]);

  React.useEffect(() => {
    loadFood();
  }, [loadFood]);

  const handleBack = React.useCallback(() => {
    navigate(sectionBasePath);
  }, [navigate, sectionBasePath]);

  const handleEdit = React.useCallback(() => {
    if (!foodId) {
      return;
    }
    navigate(`${sectionBasePath}/${foodId}/edit`);
  }, [foodId, navigate, sectionBasePath]);

  const handleToggleFavorite = React.useCallback(async () => {
    if (!foodId || !food) {
      return;
    }

    setIsLoading(true);
    try {
      const updated = food.is_favorite
        ? await unfavoriteFoodApi(foodId)
        : await favoriteFoodApi(foodId);
      setFood(updated);
      notifications.show('Favorite status updated.', {
        severity: 'success',
        autoHideDuration: 3000,
      });
    } catch (actionError) {
      notifications.show((actionError as Error).message, {
        severity: 'error',
        autoHideDuration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  }, [food, foodId, notifications]);

  const handleToggleActive = React.useCallback(async () => {
    if (!foodId || !food || !canToggleActive(food)) {
      return;
    }

    setIsLoading(true);
    try {
      const updated =
        food.status === 'active'
          ? await deactivateFoodApi(foodId)
          : await activateFoodApi(foodId);
      setFood(updated);
      notifications.show(
        food.status === 'active'
          ? 'Food has been deactivated.'
          : 'Food has been activated.',
        {
          severity: 'success',
          autoHideDuration: 3000,
        },
      );
    } catch (actionError) {
      notifications.show((actionError as Error).message, {
        severity: 'error',
        autoHideDuration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  }, [food, foodId, notifications]);

  const handleRecycle = React.useCallback(async () => {
    if (!foodId || !food) {
      return;
    }

    const confirmed = await dialogs.confirm('Move this food to the recycle bin?', {
      title: 'Recycle food',
      severity: 'warning',
      okText: 'Recycle',
      cancelText: 'Cancel',
    });

    if (!confirmed) {
      return;
    }

    setIsLoading(true);
    try {
      const updated = await recycleFoodApi(foodId);
      setFood(updated);
      notifications.show('Food moved to recycle bin.', {
        severity: 'success',
        autoHideDuration: 3000,
      });
      navigate('/home/recycle');
    } catch (actionError) {
      notifications.show((actionError as Error).message, {
        severity: 'error',
        autoHideDuration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  }, [dialogs, food, foodId, navigate, notifications]);

  const handleRestore = React.useCallback(async () => {
    if (!foodId || !food) {
      return;
    }

    const confirmed = await dialogs.confirm('Restore this food?', {
      title: 'Restore food',
      severity: 'info',
      okText: 'Restore',
      cancelText: 'Cancel',
    });

    if (!confirmed) {
      return;
    }

    setIsLoading(true);
    try {
      const updated = await restoreFoodApi(foodId);
      setFood(updated);
      notifications.show('Food restored successfully.', {
        severity: 'success',
        autoHideDuration: 3000,
      });
      navigate('/home/all');
    } catch (actionError) {
      notifications.show((actionError as Error).message, {
        severity: 'error',
        autoHideDuration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  }, [dialogs, food, foodId, navigate, notifications]);

  const handleDelete = React.useCallback(async () => {
    if (!foodId || !food) {
      return;
    }

    const confirmed = await dialogs.confirm(
      `Permanently delete "${food.name}"?`,
      {
        title: 'Delete food',
        severity: 'error',
        okText: 'Delete permanently',
        cancelText: 'Cancel',
      },
    );

    if (!confirmed) {
      return;
    }

    setIsLoading(true);
    try {
      await deleteFoodApi(foodId);
      notifications.show('Food permanently deleted.', {
        severity: 'success',
        autoHideDuration: 3000,
      });
      navigate('/home/recycle');
    } catch (actionError) {
      notifications.show((actionError as Error).message, {
        severity: 'error',
        autoHideDuration: 3000,
      });
      setIsLoading(false);
    }
  }, [dialogs, food, foodId, navigate, notifications]);

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
  } else if (food) {
    const canActivate = canToggleActive(food);
    content = (
      <Box sx={{ flexGrow: 1, width: '100%' }}>
        <Grid container spacing={2} sx={{ width: '100%' }}>
          <Grid size={{ xs: 12, sm: 8 }}>
            <Paper sx={{ px: 2, py: 1 }}>
              <Typography variant="overline">Name</Typography>
              <Typography variant="body1" sx={{ mb: 1 }}>
                {food.name}
              </Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Paper sx={{ px: 2, py: 1 }}>
              <Typography variant="overline">Status</Typography>
              <Box sx={{ mb: 1 }}>
                <Chip
                  label={getStatusLabel(food)}
                  color={getStatusColor(food)}
                  variant="outlined"
                />
              </Box>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Paper sx={{ px: 2, py: 1 }}>
              <Typography variant="overline">Description</Typography>
              <Typography variant="body1" sx={{ mb: 1, whiteSpace: 'pre-wrap' }}>
                {food.description || 'No description provided.'}
              </Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <Paper sx={{ px: 2, py: 1 }}>
              <Typography variant="overline">Cuisine</Typography>
              <Typography variant="body1" sx={{ mb: 1 }}>
                {food.cuisine ?? '-'}
              </Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <Paper sx={{ px: 2, py: 1 }}>
              <Typography variant="overline">Meal type</Typography>
              <Typography variant="body1" sx={{ mb: 1 }}>
                {food.meal_type ?? '-'}
              </Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <Paper sx={{ px: 2, py: 1 }}>
              <Typography variant="overline">Price range</Typography>
              <Typography variant="body1" sx={{ mb: 1 }}>
                {food.price_range}
              </Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <Paper sx={{ px: 2, py: 1 }}>
              <Typography variant="overline">Convenience</Typography>
              <Typography variant="body1" sx={{ mb: 1 }}>
                {food.convenience}
              </Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Paper sx={{ px: 2, py: 1 }}>
              <Typography variant="overline">Favorite</Typography>
              <Typography variant="body1" sx={{ mb: 1 }}>
                {food.is_favorite ? 'Yes' : 'No'}
              </Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Paper sx={{ px: 2, py: 1 }}>
              <Typography variant="overline">Version</Typography>
              <Typography variant="body1" sx={{ mb: 1 }}>
                {food.version}
              </Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Paper sx={{ px: 2, py: 1 }}>
              <Typography variant="overline">Archived</Typography>
              <Typography variant="body1" sx={{ mb: 1 }}>
                {food.is_recycled ? 'Yes' : 'No'}
              </Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Paper sx={{ px: 2, py: 1 }}>
              <Typography variant="overline">Created at</Typography>
              <Typography variant="body1" sx={{ mb: 1 }}>
                {dayjs(food.created_at).format('MMM D, YYYY HH:mm')}
              </Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Paper sx={{ px: 2, py: 1 }}>
              <Typography variant="overline">Updated at</Typography>
              <Typography variant="body1" sx={{ mb: 1 }}>
                {dayjs(food.updated_at).format('MMM D, YYYY HH:mm')}
              </Typography>
            </Paper>
          </Grid>
        </Grid>
        <Divider sx={{ my: 3 }} />
        <Stack direction="row" spacing={2} justifyContent="space-between" flexWrap="wrap">
          <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={handleBack}>
            Back
          </Button>
          <Stack direction="row" spacing={2} flexWrap="wrap">
            {!food.is_recycled ? (
              <>
                <Button
                  variant="outlined"
                  color="primary"
                  startIcon={<EditIcon />}
                  onClick={handleEdit}
                >
                  Edit
                </Button>
                <Button
                  variant={food.is_favorite ? 'contained' : 'outlined'}
                  color="warning"
                  startIcon={<StarRoundedIcon />}
                  onClick={handleToggleFavorite}
                >
                  {food.is_favorite ? 'Unfavorite' : 'Favorite'}
                </Button>
                <Button
                  variant="outlined"
                  color={food.status === 'active' ? 'warning' : 'success'}
                  startIcon={
                    food.status === 'active' ? (
                      <PauseCircleOutlineIcon />
                    ) : (
                      <CheckCircleOutlineIcon />
                    )
                  }
                  onClick={handleToggleActive}
                  disabled={!canActivate}
                >
                  {food.status === 'active' ? 'Deactivate' : 'Activate'}
                </Button>
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<DeleteOutlineRoundedIcon />}
                  onClick={handleRecycle}
                >
                  Recycle
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outlined"
                  color="info"
                  startIcon={<RestoreFromTrashIcon />}
                  onClick={handleRestore}
                >
                  Restore
                </Button>
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={handleDelete}
                >
                  Delete permanently
                </Button>
              </>
            )}
          </Stack>
        </Stack>
      </Box>
    );
  }

  return (
    <PageContainer
      title={pageTitle}
      breadcrumbs={[
        { title: sectionTitle, path: sectionBasePath },
        { title: pageTitle },
      ]}
    >
      <Box sx={{ display: 'flex', flex: 1, width: '100%' }}>{content}</Box>
    </PageContainer>
  );
}

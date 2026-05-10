import * as React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import OutlinedInput from '@mui/material/OutlinedInput';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import {
  DataGrid,
  type GridColDef,
  type GridEventListener,
  type GridRenderCellParams,
  gridClasses,
} from '@mui/x-data-grid';
import { useLocation, useNavigate } from 'react-router-dom';
import { listFoodsApi, type FoodListView, type FoodReadResp } from '../data/food_server';
import PageContainer from './PageContainer';

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-AU', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
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
  return 'default';
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
  return 'Inactive';
}

function getEmbeddingStatusColor(
  food: FoodReadResp,
): 'default' | 'success' | 'info' | 'warning' | 'error' {
  if (food.embedding_status === 'ready') {
    return 'success';
  }
  if (food.embedding_status === 'processing') {
    return 'info';
  }
  if (food.embedding_status === 'failed') {
    return 'error';
  }
  if (food.embedding_status === 'pending') {
    return 'warning';
  }
  return 'default';
}

function getEmbeddingStatusLabel(food: FoodReadResp): string {
  return food.embedding_status.replaceAll('_', ' ');
}

function getViewFromPathname(pathname: string): FoodListView {
  if (pathname.startsWith('/home/favorites')) {
    return 'favorites';
  }
  if (pathname.startsWith('/home/recycle')) {
    return 'recycle';
  }
  return 'all';
}

function getSectionBasePath(view: FoodListView): string {
  if (view === 'favorites') {
    return '/home/favorites';
  }
  if (view === 'recycle') {
    return '/home/recycle';
  }
  return '/home/all';
}

export default function FoodList() {
  const { pathname } = useLocation();
  const view = React.useMemo(() => getViewFromPathname(pathname), [pathname]);
  const sectionBasePath = React.useMemo(() => getSectionBasePath(view), [view]);
  const navigate = useNavigate();

  const [keyword, setKeyword] = React.useState('');
  const [rows, setRows] = React.useState<FoodReadResp[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  const loadData = React.useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const response = await listFoodsApi({
        view,
        keyword: keyword.trim() || undefined,
      });
      setRows(response);
    } catch (loadError) {
      setError(loadError as Error);
    } finally {
      setIsLoading(false);
    }
  }, [keyword, view]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = React.useCallback(() => {
    if (!isLoading) {
      loadData();
    }
  }, [isLoading, loadData]);

  const handleRowClick = React.useCallback<GridEventListener<'rowClick'>>(
    ({ row }) => {
      navigate(`${sectionBasePath}/${row.id}`);
    },
    [navigate, sectionBasePath],
  );

  const handleCreate = React.useCallback(() => {
    navigate(`${sectionBasePath}/new`);
  }, [navigate, sectionBasePath]);

  const columns = React.useMemo<GridColDef<FoodReadResp>[]>(
    () => [
      { field: 'name', headerName: 'Name', minWidth: 180, flex: 1 },
      {
        field: 'status',
        headerName: 'Status',
        minWidth: 120,
        flex: 0.7,
        renderCell: (params: GridRenderCellParams<FoodReadResp>) => (
          <Chip
            label={getStatusLabel(params.row)}
            color={getStatusColor(params.row)}
            size="small"
            variant="outlined"
          />
        ),
      },
      {
        field: 'embedding_status',
        headerName: 'Embedding',
        minWidth: 150,
        flex: 0.7,
        renderCell: (params: GridRenderCellParams<FoodReadResp>) => (
          <Chip
            label={getEmbeddingStatusLabel(params.row)}
            color={getEmbeddingStatusColor(params.row)}
            size="small"
            variant="outlined"
          />
        ),
      },
      {
        field: 'cuisine',
        headerName: 'Cuisine',
        minWidth: 130,
        flex: 0.7,
        valueGetter: (_value, row) => row.cuisine ?? '-',
      },
      {
        field: 'meal_type',
        headerName: 'Meal type',
        minWidth: 130,
        flex: 0.7,
        valueGetter: (_value, row) => row.meal_type ?? '-',
      },
      {
        field: 'is_favorite',
        headerName: 'Favorite',
        minWidth: 110,
        flex: 0.5,
        valueGetter: (_value, row) => (row.is_favorite ? 'Yes' : 'No'),
      },
      {
        field: 'updated_at',
        headerName: 'Updated at',
        minWidth: 210,
        flex: 0.9,
        valueFormatter: (value?: string) => (value ? formatDateTime(value) : ''),
      },
      {
        field: 'created_at',
        headerName: 'Created at',
        minWidth: 210,
        flex: 0.9,
        valueFormatter: (value?: string) => (value ? formatDateTime(value) : ''),
      },
    ],
    [],
  );

  const pageTitle =
    view === 'favorites'
      ? 'Favorite foods'
      : view === 'recycle'
        ? 'Recycled foods'
        : 'All foods';

  return (
    <PageContainer
      title={pageTitle}
      breadcrumbs={[{ title: pageTitle }]}
      actions={
        <Stack direction="row" alignItems="center" spacing={1}>
          <OutlinedInput
            size="small"
            placeholder="Search foods"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            sx={{
              minWidth: 240,
              height: '2.25rem',
              '& input': {
                height: '100%',
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
              },
            }}
          />
          <Tooltip title="Reload" placement="right" enterDelay={1000}>
            <div>
              <IconButton size="small" aria-label="Reload" onClick={handleRefresh}>
                <RefreshIcon />
              </IconButton>
            </div>
          </Tooltip>
          {view !== 'recycle' ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
              New food
            </Button>
          ) : null}
        </Stack>
      }
    >
      <Box sx={{ flex: 1, width: '100%' }}>
        {error ? (
          <Box sx={{ flexGrow: 1 }}>
            <Alert severity="error">{error.message}</Alert>
          </Box>
        ) : (
          <DataGrid
            rows={rows}
            columns={columns}
            pagination
            pageSizeOptions={[10, 25, 50]}
            disableRowSelectionOnClick
            onRowClick={handleRowClick}
            loading={isLoading}
            initialState={{
              pagination: { paginationModel: { page: 0, pageSize: 10 } },
            }}
            sx={{
              [`& .${gridClasses.columnHeader}, & .${gridClasses.cell}`]: {
                outline: 'transparent',
                justifyContent: 'flex-start',
              },
              [`& .${gridClasses.columnHeader}:focus-within, & .${gridClasses.cell}:focus-within`]:
                {
                  outline: 'none',
                },
              [`& .${gridClasses.columnHeaderTitleContainer}`]: {
                justifyContent: 'flex-start',
              },
              [`& .${gridClasses.cell}`]: {
                alignItems: 'center',
              },
              [`& .${gridClasses.row}:hover`]: {
                cursor: 'pointer',
              },
            }}
            slotProps={{
              loadingOverlay: {
                variant: 'circular-progress',
                noRowsVariant: 'circular-progress',
              },
              baseIconButton: {
                size: 'small',
              },
            }}
          />
        )}
      </Box>
    </PageContainer>
  );
}

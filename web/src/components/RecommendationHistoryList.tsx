import * as React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  DataGrid,
  type GridColDef,
  type GridEventListener,
  type GridPaginationModel,
  gridClasses,
} from '@mui/x-data-grid';
import { useNavigate } from 'react-router-dom';
import {
  listRecommendationHistoriesApi,
  type RecommendationHistorySummary,
} from '../data/history_server';
import PageContainer from './PageContainer';
import { formatTimestamp } from '../recommendation/shared';

export default function RecommendationHistoryList() {
  const navigate = useNavigate();
  const [rows, setRows] = React.useState<RecommendationHistorySummary[]>([]);
  const [rowCount, setRowCount] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const [paginationModel, setPaginationModel] = React.useState<GridPaginationModel>({
    page: 0,
    pageSize: 10,
  });

  const loadData = React.useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const response = await listRecommendationHistoriesApi({
        limit: paginationModel.pageSize,
        offset: paginationModel.page * paginationModel.pageSize,
      });
      setRows(response.items);
      setRowCount(response.total);
    } catch (loadError) {
      setError(loadError as Error);
    } finally {
      setIsLoading(false);
    }
  }, [paginationModel.page, paginationModel.pageSize]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleRefresh = React.useCallback(() => {
    if (!isLoading) {
      void loadData();
    }
  }, [isLoading, loadData]);

  const handleRowClick = React.useCallback<GridEventListener<'rowClick'>>(
    ({ row }) => {
      navigate(`/home/history/${row.id}`);
    },
    [navigate],
  );

  const columns = React.useMemo<GridColDef<RecommendationHistorySummary>[]>(
    () => [
      {
        field: 'created_at',
        headerName: 'Recommended at',
        minWidth: 210,
        flex: 1,
        valueFormatter: (value?: string) => (value ? formatTimestamp(value) : ''),
      },
      {
        field: 'recommendation_count',
        headerName: 'Results',
        minWidth: 100,
        flex: 0.45,
      },
      {
        field: 'candidate_pool_size',
        headerName: 'Candidate pool',
        minWidth: 130,
        flex: 0.7,
      },
      {
        field: 'coarse_top_k',
        headerName: 'Coarse top K',
        minWidth: 110,
        flex: 0.55,
      },
      {
        field: 'final_top_k',
        headerName: 'Final top K',
        minWidth: 110,
        flex: 0.55,
      },
    ],
    [],
  );

  return (
    <PageContainer
      title="Recommendation history"
      breadcrumbs={[{ title: 'Recommendation history' }]}
      actions={
        <Stack direction="row" alignItems="center" spacing={1}>
          <Tooltip title="Reload" placement="right" enterDelay={1000}>
            <div>
              <IconButton size="small" aria-label="Reload" onClick={handleRefresh}>
                <RefreshIcon />
              </IconButton>
            </div>
          </Tooltip>
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
            paginationMode="server"
            rowCount={rowCount}
            pageSizeOptions={[10, 20, 50]}
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            disableRowSelectionOnClick
            onRowClick={handleRowClick}
            loading={isLoading}
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

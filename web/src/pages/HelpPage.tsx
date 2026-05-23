import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import RestoreFromTrashRoundedIcon from '@mui/icons-material/RestoreFromTrashRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link } from 'react-router-dom';
import PageContainer from '../components/PageContainer';

const quickActions = [
  {
    title: 'Add foods',
    description: 'Create items in All foods, then fill in tags and a short description.',
    icon: <AddRoundedIcon color="primary" />,
  },
  {
    title: 'Search and filter',
    description: 'Use the search box on food lists to narrow the table before opening an item.',
    icon: <SearchRoundedIcon color="info" />,
  },
  {
    title: 'Favorite reliable picks',
    description: 'Use favorites for regular meals you are happy to see again.',
    icon: <FavoriteRoundedIcon color="warning" />,
  },
  {
    title: 'Recover recycled food',
    description: 'Open Recycle bin when an inactive item should return to your active pool.',
    icon: <RestoreFromTrashRoundedIcon color="success" />,
  },
];

const recommendationTips = [
  'Select at least one cuisine, meal type, price, and convenience option.',
  'Use Extra request for mood, weather, dietary preference, or texture notes.',
  'Enable favorite-only mode when you want safer, familiar suggestions.',
  'Keep at least 30 eligible active foods for the recommendation pool.',
];

const questions = [
  {
    question: 'Why are recommendations unavailable?',
    answer:
      'The candidate pool may be too small, required preference sections may be empty, or the backend/model provider may not be running.',
  },
  {
    question: 'Why is embedding status pending or processing?',
    answer:
      'New and edited foods are queued for embedding work. Reload the list after the backend worker has had time to process them.',
  },
  {
    question: 'What happens when AI services are not configured?',
    answer:
      'What2Eat can fall back to rule-based recall, score ordering, and template reasons so the flow still remains usable.',
  },
];

export default function HelpPage() {
  return (
    <PageContainer
      title="Help"
      breadcrumbs={[{ title: 'Help' }]}
      actions={
        <Stack direction="row" spacing={1}>
          <Button
            component={Link}
            to="/home/all/new"
            variant="outlined"
            startIcon={<AddRoundedIcon />}
          >
            New food
          </Button>
          <Button
            component={Link}
            to="/home/recommend"
            variant="contained"
            startIcon={<AutoAwesomeRoundedIcon />}
          >
            Recommend
          </Button>
        </Stack>
      }
    >
      <Stack spacing={2} sx={{ width: '100%' }}>
        <Alert severity="info" icon={<TuneRoundedIcon />}>
          Best results come from a well-tagged food library. Cuisine, meal type,
          price, convenience, and descriptions all help recommendations stay relevant.
        </Alert>

        <Grid container spacing={2}>
          {quickActions.map((action) => (
            <Grid key={action.title} size={{ xs: 12, sm: 6, lg: 3 }}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Stack spacing={1}>
                    <Box>{action.icon}</Box>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {action.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {action.description}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <AutoAwesomeRoundedIcon color="secondary" />
                    <Typography variant="h6">Recommendation checklist</Typography>
                  </Stack>
                  <Stack spacing={1}>
                    {recommendationTips.map((tip) => (
                      <Stack
                        key={tip}
                        direction="row"
                        spacing={1.25}
                        alignItems="flex-start"
                      >
                        <Chip label="Tip" size="small" color="primary" variant="outlined" />
                        <Typography variant="body2" color="text.secondary">
                          {tip}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <HistoryRoundedIcon color="info" />
                    <Typography variant="h6">History and refresh</Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Recommendation history stores the original preference snapshot,
                    result count, candidate pool, and generated reasons. Use history
                    to compare past decisions or recover a good idea from another day.
                  </Typography>
                  <Divider />
                  <Stack direction="row" spacing={1} alignItems="center">
                    <RefreshRoundedIcon color="action" />
                    <Typography variant="body2" color="text.secondary">
                      Reload buttons refresh tables and status chips without changing
                      the current page.
                    </Typography>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1.5}>
              <Typography variant="h6">Common questions</Typography>
              {questions.map((item, index) => (
                <Box key={item.question}>
                  {index > 0 ? <Divider sx={{ mb: 1.5 }} /> : null}
                  <Typography variant="subtitle2">{item.question}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {item.answer}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </PageContainer>
  );
}

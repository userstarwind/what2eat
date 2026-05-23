import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import PageContainer from '../components/PageContainer';

const featureCards = [
  {
    title: 'Food library',
    description:
      'Keep meals, snacks, and go-to orders in one private collection with cuisine, meal type, price, and convenience tags.',
    icon: <Inventory2RoundedIcon color="primary" />,
  },
  {
    title: 'Favorites',
    description:
      'Mark reliable choices so the recommendation flow can focus on the foods you already trust.',
    icon: <StarRoundedIcon color="warning" />,
  },
  {
    title: 'Smart recommendations',
    description:
      'Turn a few preference chips and an optional free-text request into ranked food suggestions with reasons.',
    icon: <AutoAwesomeRoundedIcon color="secondary" />,
  },
  {
    title: 'Traceable history',
    description:
      'Review previous recommendation runs, candidate pool sizes, scores, and saved reasons whenever a meal deserves a replay.',
    icon: <HistoryRoundedIcon color="info" />,
  },
];

const workflowSteps = [
  'Add foods you actually eat or want to remember.',
  'Tag each item so recommendations can filter sensibly.',
  'Ask for ideas from all active foods or favorites only.',
  'Review the ranked results and revisit them later in history.',
];

const techItems = [
  'React',
  'Vite',
  'MUI',
  'FastAPI',
  'PostgreSQL',
  'Redis',
  'AI ranking',
];

export default function AboutPage() {
  return (
    <PageContainer title="About What2Eat" breadcrumbs={[{ title: 'About' }]}>
      <Stack spacing={2} sx={{ width: '100%' }}>
        <Box
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            p: { xs: 2, md: 3 },
            bgcolor: 'background.paper',
          }}
        >
          <Stack spacing={1.5}>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              flexWrap="wrap"
              useFlexGap
            >
              <Chip icon={<SearchRoundedIcon />} label="Decision support" size="small" />
              <Chip icon={<RestartAltRoundedIcon />} label="Fallback aware" size="small" />
            </Stack>
            <Typography variant="h5">For the daily question: what should I eat?</Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 820 }}>
              What2Eat is a small food recommendation system built to reduce meal
              decision fatigue. It gives your own food collection enough structure to
              support search, favorites, recycling, recommendation, and history without
              turning dinner into spreadsheet work.
            </Typography>
          </Stack>
        </Box>

        <Grid container spacing={2}>
          {featureCards.map((feature) => (
            <Grid key={feature.title} size={{ xs: 12, md: 6 }}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Stack spacing={1.25}>
                    <Box>{feature.icon}</Box>
                    <Typography variant="h6">{feature.title}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {feature.description}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 7 }}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Stack spacing={1.5}>
                  <Typography variant="h6">How it works</Typography>
                  <Stack spacing={1}>
                    {workflowSteps.map((step, index) => (
                      <Stack
                        key={step}
                        direction="row"
                        spacing={1.5}
                        alignItems="flex-start"
                      >
                        <Chip label={index + 1} size="small" color="primary" />
                        <Typography variant="body2" color="text.secondary">
                          {step}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Stack spacing={1.5}>
                  <Typography variant="h6">Built with</Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {techItems.map((item) => (
                      <Chip key={item} label={item} variant="outlined" />
                    ))}
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    The app uses structured filters first, then can enhance recall,
                    ranking, and reasons with OpenAI-compatible model providers when
                    they are configured.
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Stack>
    </PageContainer>
  );
}

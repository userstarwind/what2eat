import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import ChecklistRoundedIcon from '@mui/icons-material/ChecklistRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import RestaurantMenuRoundedIcon from '@mui/icons-material/RestaurantMenuRounded';

export default function SignInContent() {
  const items = [
    {
      icon: <RestaurantMenuRoundedIcon sx={{ color: 'text.secondary' }} />,
      title: 'Build your food library',
      description:
        'Keep the dishes, snacks, and meal options you actually want to recommend in one place.',
    },
    {
      icon: <ChecklistRoundedIcon sx={{ color: 'text.secondary' }} />,
      title: 'Capture useful preference signals',
      description:
        'Record dietary needs, cravings, and everyday constraints before making a suggestion.',
    },
    {
      icon: <AutoAwesomeRoundedIcon sx={{ color: 'text.secondary' }} />,
      title: 'Turn inputs into better picks',
      description:
        'Match people with food options that feel considered instead of random or repetitive.',
    },
    {
      icon: <InsightsRoundedIcon sx={{ color: 'text.secondary' }} />,
      title: 'Keep options tidy over time',
      description:
        'Use favorites, active states, and recycle flows to keep your catalog clean as it grows.',
    },
  ];

  return (
    <Stack
      sx={{
        flexDirection: 'column',
        gap: 4,
        width: '100%',
        maxWidth: { xs: '100%', md: 560 },
        textAlign: 'left',
      }}
    >
      <Box>
        <Typography
          variant="overline"
          sx={{ letterSpacing: 1.4, color: 'success.dark', fontWeight: 700 }}
        >
          Personalized food recommendations
        </Typography>
        <Typography
          variant="h3"
          sx={{ mt: 1.5, fontSize: 'clamp(2.2rem, 5vw, 3.5rem)', maxWidth: 520 }}
        >
          WHAT2EAT
        </Typography>
        <Typography variant="body1" sx={{ mt: 2, color: 'text.secondary', maxWidth: 520 }}>
          what2eat helps you maintain a usable food catalog, understand what people want,
          and turn that context into more relevant meal suggestions.
        </Typography>
      </Box>
      {items.map((item, index) => (
        <Stack key={index} direction="row" sx={{ gap: 2, alignItems: 'flex-start' }}>
          {item.icon}
          <Box>
            <Typography gutterBottom sx={{ fontWeight: 'medium' }}>
              {item.title}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {item.description}
            </Typography>
          </Box>
        </Stack>
      ))}
    </Stack>
  );
}

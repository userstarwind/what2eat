import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export default function AboutPage() {

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        About
      </Typography>
      <Typography color="text.secondary">
        This is the about page.
      </Typography>
    </Box>
  );
}

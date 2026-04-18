import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export default function HelpPage() {

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Help
      </Typography>
      <Typography color="text.secondary">
        This is the help page.
      </Typography>
    </Box>
  );
}

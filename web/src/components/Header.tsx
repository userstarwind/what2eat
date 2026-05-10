import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TopRightControls from './TopRightControls';

export default function Header() {
  return (
    <Box
      sx={{
        width: '100%',
        display: { xs: 'none', md: 'block' },
        position: 'sticky',
        top: 0,
        zIndex: (theme) => theme.zIndex.appBar,
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Container maxWidth={false} sx={{ px: { md: 3, lg: 4 } }}>
        <Stack
          direction="row"
          sx={{
            minHeight: 72,
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
          }}
          spacing={2}
        >
          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
            <Box
              component="img"
              src="/logo.svg"
              alt="what2eat logo"
              sx={{ width: 28, height: 28, display: 'block' }}
            />
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                letterSpacing: 0.2,
                lineHeight: 1,
              }}
            >
              What2Eat
            </Typography>
          </Stack>
          <TopRightControls />
        </Stack>
      </Container>
    </Box>
  );
}

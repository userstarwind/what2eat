import * as React from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import Stack from '@mui/material/Stack';
import { useNavigate } from 'react-router-dom';
import AppTheme from '../shared-theme/AppTheme';
import SignInCard from '../components/SignInCard';
import Content from '../components/SignInContent';
import { getAccessToken } from '../data/user_server';
import TopRightControls from '../components/TopRightControls';

export default function LoginPage(props: { disableCustomTheme?: boolean }) {
  const navigate = useNavigate();

  React.useEffect(() => {
    if (getAccessToken()) {
        navigate('/home', { replace: true });
      }
  }, [navigate]);

  return (
    <AppTheme {...props}>
      <CssBaseline enableColorScheme />
      <TopRightControls floating />
      <Stack
        component="main"
        sx={(theme) => ({
          position: 'relative',
          isolation: 'isolate',
          minHeight: '100dvh',
          px: { xs: 2, sm: 4, md: 6 },
          py: { xs: 4, md: 6 },
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            zIndex: -1,
            inset: 0,
            backgroundImage:
              'radial-gradient(120% 120% at 6% 8%, hsl(48, 100%, 92%) 0%, hsl(140, 65%, 95%) 44%, hsl(0, 0%, 100%) 74%)',
            backgroundRepeat: 'no-repeat',
            ...theme.applyStyles('dark', {
              backgroundImage:
                'radial-gradient(120% 120% at 6% 8%, hsla(38, 95%, 55%, 0.22) 0%, hsla(145, 70%, 35%, 0.18) 34%, hsl(160, 24%, 8%) 74%)',
            }),
          },
        })}
      >
        <Stack
          direction={{ xs: 'column-reverse', md: 'row' }}
          sx={{
            width: '100%',
            maxWidth: 1200,
            mx: 'auto',
            my: 'auto',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: { xs: 4, md: 8 },
          }}
        >
          <Content />
          <SignInCard />
        </Stack>
      </Stack>
    </AppTheme>
  );
}

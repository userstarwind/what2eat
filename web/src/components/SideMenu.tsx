import * as React from 'react';
import { styled } from '@mui/material/styles';
import Avatar from '@mui/material/Avatar';
import MuiDrawer, { drawerClasses } from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import MenuContent from './MenuContent';
import IconButton from '@mui/material/IconButton';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, logoutApi } from '../data/user_server';

const drawerWidth = 300;
const desktopHeaderHeight = 72;

const Drawer = styled(MuiDrawer)({
  width: drawerWidth,
  flexShrink: 0,
  boxSizing: 'border-box',
  [`& .${drawerClasses.paper}`]: {
    width: drawerWidth,
    boxSizing: 'border-box',
    top: desktopHeaderHeight,
    height: `calc(100% - ${desktopHeaderHeight}px)`,
    borderTop: '1px solid',
  },
});

function stringToColor(string: string) {
  let hash = 0;
  /* eslint-disable no-bitwise */
  for (let i = 0; i < string.length; i += 1) {
    hash = string.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = '#';
  for (let i = 0; i < 3; i += 1) {
    const value = (hash >> (i * 8)) & 0xff;
    color += `00${value.toString(16)}`.slice(-2);
  }
  /* eslint-enable no-bitwise */
  return color;
}

function stringAvatar(name: string) {
  const s = (name ?? '').trim();
  const first = s ? (Array.from(s)[0] || '?').toUpperCase() : '?';

  return {
    sx: {
      bgcolor: stringToColor(s || 'guest'),
    },
    children: first,
  };
}


export default function SideMenu() {
  const [loggingOut, setLoggingOut] = React.useState(false);
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const name = currentUser?.full_name || currentUser?.email?.split('@')[0] || 'Guest';
  const email = currentUser?.email || '';

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      logoutApi();
    } catch (e) {
      console.error('Logout failed:', e);
    } finally {
      setLoggingOut(false);
      navigate('/login');
    }
  };
  return (
    <Drawer
      variant="permanent"
      sx={{
        display: { xs: 'none', md: 'block' },
        [`& .${drawerClasses.paper}`]: {
          backgroundColor: 'background.paper',
          borderColor: 'divider',
        },
      }}
    >
      <Box
        sx={{
          overflow: 'auto',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <MenuContent />
      </Box>
      <Stack
        direction="row"
        sx={{
          p: 2,
          gap: 1,
          alignItems: 'center',
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Avatar
          sizes="small"
          {...stringAvatar(name)}
          sx={{ width: 36, height: 36 }}
        />
        <Box sx={{ mr: 'auto' }}>
          <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: '16px' }}>
            {name}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {email}
          </Typography>
        </Box>
        <IconButton
          aria-label="logout"
          size="small"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          <LogoutRoundedIcon fontSize="inherit" />
        </IconButton>
      </Stack>
    </Drawer>
  );
}

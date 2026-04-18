import * as React from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Drawer, { drawerClasses } from '@mui/material/Drawer';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import MenuContent from './MenuContent';
import { getCurrentUser, logoutApi } from '../data/user_server';
import { useNavigate } from 'react-router-dom';

interface SideMenuMobileProps {
  open: boolean | undefined;
  toggleDrawer: (newOpen: boolean) => () => void;
}

function stringToColor(value: string) {
  let hash = 0;
  /* eslint-disable no-bitwise */
  for (let i = 0; i < value.length; i += 1) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = '#';
  for (let i = 0; i < 3; i += 1) {
    const channel = (hash >> (i * 8)) & 0xff;
    color += `00${channel.toString(16)}`.slice(-2);
  }
  /* eslint-enable no-bitwise */
  return color;
}

function stringAvatar(name: string) {
  const normalized = name.trim();
  const first = normalized ? (Array.from(normalized)[0] || '?').toUpperCase() : '?';

  return {
    sx: {
      bgcolor: stringToColor(normalized || 'guest'),
    },
    children: first,
  };
}

export default function SideMenuMobile({
  open,
  toggleDrawer,
}: SideMenuMobileProps) {
  const [loggingOut, setLoggingOut] = React.useState(false);
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const name = currentUser?.full_name || currentUser?.email?.split('@')[0] || 'Guest';
  const email = currentUser?.email || '';

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      logoutApi();
      toggleDrawer(false)();
      navigate('/', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={toggleDrawer(false)}
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        [`& .${drawerClasses.paper}`]: {
          backgroundImage: 'none',
          backgroundColor: 'background.paper',
        },
      }}
    >
      <Stack
        sx={{
          width: 300,
          maxWidth: '80dvw',
          height: '100%',
        }}
      >
        <Stack sx={{ flexGrow: 1 }}>
          <MenuContent />
        </Stack>
        <Divider />
        <Stack
          direction="row"
          sx={{
            p: 2,
            gap: 1,
            alignItems: 'center',
          }}
        >
          <Avatar {...stringAvatar(name)} sx={{ width: 36, height: 36 }} />
          <Box sx={{ mr: 'auto', minWidth: 0 }}>
            <Typography noWrap variant="body2" sx={{ fontWeight: 500, lineHeight: '16px' }}>
              {name}
            </Typography>
            <Typography noWrap variant="caption" sx={{ color: 'text.secondary' }}>
              {email}
            </Typography>
          </Box>
        </Stack>
        <Stack sx={{ p: 2, pt: 0 }}>
          <Button
            variant="outlined"
            fullWidth
            startIcon={<LogoutRoundedIcon />}
            onClick={handleLogout}
            disabled={loggingOut}
          >
            Logout
          </Button>
        </Stack>
      </Stack>
    </Drawer>
  );
}

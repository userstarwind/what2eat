import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import ViewListRoundedIcon from '@mui/icons-material/ViewListRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import HelpRoundedIcon from '@mui/icons-material/HelpRounded';
import { useNavigate, useLocation } from 'react-router-dom';

export default function MenuContent() {
  const navigate = useNavigate();
  const location = useLocation();

  const mainListItems = [
    { text: 'All foods', icon: <ViewListRoundedIcon />, path: '/home/all' },
    { text: 'Favorites', icon: <StarRoundedIcon />, path: '/home/favorites' },
    { text: 'Recycle bin', icon: <DeleteOutlineRoundedIcon />, path: '/home/recycle' },
    { text: 'Recommendations', icon: <AutoAwesomeRoundedIcon />, path: '/home/recommend' },
  ];

  const secondaryListItems = [
    { text: 'About', icon: <InfoRoundedIcon />, path: '/home/about' },
    { text: 'Help', icon: <HelpRoundedIcon />, path: '/home/help' },
  ];

  return (
    <Stack sx={{ flexGrow: 1, p: 1, justifyContent: 'space-between' }}>
      <List dense>
        {mainListItems.map((item) => (
          <ListItem key={item.path} disablePadding sx={{ display: 'block' }}>
            <ListItemButton
              selected={location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)}
              onClick={() => navigate(item.path)}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <List dense>
        {secondaryListItems.map((item) => (
          <ListItem key={item.path} disablePadding sx={{ display: 'block' }}>
            <ListItemButton
              selected={location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)}
              onClick={() => navigate(item.path)}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Stack>
  );
}

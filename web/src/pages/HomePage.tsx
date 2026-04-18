import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import AppNavbar from '../components/AppNavbar';
import Header from '../components/Header';
import SideMenu from '../components/SideMenu';
import AppTheme from '../shared-theme/AppTheme';
import { dataGridCustomizations } from '../shared-theme/customizations/dataGrid';
import { datePickersCustomizations } from '../shared-theme/customizations/datePickers';
import Copyright from '../components/Copyright';
import { Outlet } from 'react-router-dom';
const xThemeComponents = {
  ...dataGridCustomizations,
  ...datePickersCustomizations,
};

export default function HomePage(props: { disableCustomTheme?: boolean }) {
  return (
    <AppTheme {...props} themeComponents={xThemeComponents}>
      <CssBaseline enableColorScheme />
      <Box
        sx={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.default',
        }}
      >
        <Header />
        <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <SideMenu />
          <Box
            component="main"
            sx={{
              flex: 1,
              minWidth: 0,
              pt: { xs: 9, md: 0 },
            }}
          >
            <AppNavbar />
            <Outlet />
            <Copyright />
          </Box>
        </Box>
      </Box>
    </AppTheme>
  );
}

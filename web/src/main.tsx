import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { BrowserRouter } from 'react-router-dom';
import DialogsProvider from './hooks/useDialogs/DialogsProvider.tsx';
import NotificationsProvider from './hooks/useNotifications/NotificationsProvider.tsx';
createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <NotificationsProvider>
      <DialogsProvider>
        <App />
      </DialogsProvider>
    </NotificationsProvider>
  </BrowserRouter>
)

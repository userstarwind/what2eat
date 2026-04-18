import * as React from 'react';
import type { CloseNotification, ShowNotification } from './useNotifications';

const NotificationsContext = React.createContext<{
  show: ShowNotification;
  close: CloseNotification;
} | null>(null);

export default NotificationsContext;

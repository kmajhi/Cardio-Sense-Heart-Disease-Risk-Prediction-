import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { buildNotification } from '../clinical/notifications';
import { getHistory } from '../api/historyApi';

// App-wide notification state: the latest assessment, its notification (model
// risk + grouped clinical alerts), the profile used to personalise guidance,
// and whether the user has seen it. The nav bell, the Prediction result card
// and the Guidance page all read from here, so they never disagree.

const NotificationsContext = createContext(null);
const READ_KEY = 'cardio-sense:notification-read';

function readStored() {
  try {
    return localStorage.getItem(READ_KEY);
  } catch {
    return null; // storage blocked: the dot just reappears on reload
  }
}

export function NotificationsProvider({ profile, children }) {
  const [assessment, setAssessment] = useState(null);
  const [readKey, setReadKey] = useState(readStored);

  // The latest saved assessment. A prediction made in this session replaces it (setLatest).
  useEffect(() => {
    let alive = true;
    getHistory()
      .then((records) => alive && setAssessment((current) => current ?? records.at(-1) ?? null))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const notification = useMemo(() => buildNotification(assessment), [assessment]);
  const unread = Boolean(notification?.needsAttention && notification.key !== readKey);

  const markRead = useCallback(() => {
    if (!notification) return;
    setReadKey(notification.key);
    try {
      localStorage.setItem(READ_KEY, notification.key);
    } catch {
      /* per-visit only */
    }
  }, [notification]);

  const value = useMemo(
    () => ({ assessment, notification, profile, unread, markRead, setLatest: setAssessment }),
    [assessment, notification, profile, unread, markRead],
  );
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

/** null outside the provider (pages rendered on their own keep working). */
export const useNotifications = () => useContext(NotificationsContext);

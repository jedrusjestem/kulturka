import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { computePerms } from './lib/perms';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

const SEEN_KEY = 'kulturka-important-seen';

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = ładowanie
  const [profile, setProfile] = useState(null);
  const [recovery, setRecovery] = useState(false);
  const [counts, setCounts] = useState({ pendingMembers: 0, pendingAnnouncements: 0, unreadImportant: 0 });

  const loadProfile = useCallback(async () => {
    try {
      const p = await api.getMyProfile();
      setProfile(p);
      return p;
    } catch (e) {
      console.error(e);
      setProfile(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let alive = true;
    if (new URLSearchParams(window.location.search).get('reset') === '1') setRecovery(true);
    api.getSession().then(async (s) => {
      if (!alive) return;
      if (s) await loadProfile();
      setSession(s);
    });
    const off = api.onAuthChange(async (s, event) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'TOKEN_REFRESHED') return;
      if (s) await loadProfile();
      else {
        setProfile(null);
        localStorage.removeItem('kulturka-qr-secret');
      }
      setSession(s);
      // usuń ?code=… / ?reset=1 z paska adresu po zalogowaniu z linku e-mail
      if (s && window.location.search) {
        window.history.replaceState(null, '', window.location.pathname + window.location.hash);
      }
    });
    return () => {
      alive = false;
      off?.();
    };
  }, [loadProfile]);

  const perms = useMemo(() => computePerms(profile), [profile]);

  const refreshCounts = useCallback(async () => {
    if (!perms.active) return;
    try {
      const [anns, people] = await Promise.all([
        api.listAnnouncements(),
        perms.board ? api.listProfiles() : Promise.resolve([]),
      ]);
      const seen = localStorage.getItem(SEEN_KEY) || '1970';
      setCounts({
        pendingMembers: people.filter((p) => p.role === 'pending').length,
        pendingAnnouncements: perms.board ? anns.filter((a) => a.status === 'pending').length : 0,
        unreadImportant: anns.filter((a) => a.status === 'published' && a.created_at > seen && a.author_id !== profile?.id)
          .length,
      });
    } catch (e) {
      console.warn(e);
    }
  }, [perms.active, perms.board, profile?.id]);

  useEffect(() => {
    refreshCounts();
    const t = setInterval(refreshCounts, 60000);
    return () => clearInterval(t);
  }, [refreshCounts]);

  const markImportantSeen = useCallback(() => {
    localStorage.setItem(SEEN_KEY, new Date().toISOString());
    setCounts((c) => ({ ...c, unreadImportant: 0 }));
  }, []);

  const value = {
    session,
    profile,
    setProfile,
    perms,
    loading: session === undefined,
    refreshProfile: loadProfile,
    counts,
    refreshCounts,
    markImportantSeen,
    recovery,
    clearRecovery: () => setRecovery(false),
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

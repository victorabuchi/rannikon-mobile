import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import api from './api';

const TOKEN_KEY = 'rannikon_token';
const WORKER_KEY = 'rannikon_worker';

export async function getToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function saveToken(token) {
  return SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken() {
  return SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function getStoredWorker() {
  const raw = await AsyncStorage.getItem(WORKER_KEY);
  return raw ? JSON.parse(raw) : null;
}

async function saveStoredWorker(worker) {
  return AsyncStorage.setItem(WORKER_KEY, JSON.stringify(worker));
}

async function clearStoredWorker() {
  return AsyncStorage.removeItem(WORKER_KEY);
}

// Matches web's login.js redirect: admin and supervisor land on their own
// tool, everyone else (including housemaster/payroll) lands on the worker
// dashboard - same as web, they reach their own tool via the admin's
// "All pages" menu or a direct link, not a role-specific landing page.
export function roleHomePath(role) {
  if (role === 'admin') return '/admin';
  if (role === 'supervisor') return '/supervisor';
  return '/days';
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [worker, setWorker] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshWorker = useCallback(async () => {
    const { data } = await api.get('/api/auth/me');
    setWorker(data.worker);
    await saveStoredWorker(data.worker);
    return data.worker;
  }, []);

  useEffect(() => {
    (async () => {
      const storedToken = await getToken();
      if (storedToken) {
        setToken(storedToken);
        try {
          await refreshWorker();
        } catch (err) {
          if (err.response?.status === 401) {
            await clearToken();
            await clearStoredWorker();
            setToken(null);
            setWorker(null);
          } else {
            // Transient failure (network blip, server hiccup): keep the
            // session alive using the last-known worker instead of forcing
            // a logout, matching the web app's behavior.
            const cached = await getStoredWorker();
            setWorker(cached);
          }
        }
      }
      setIsLoading(false);
    })();
  }, [refreshWorker]);

  const signIn = useCallback(async (newToken, newWorker) => {
    await saveToken(newToken);
    setToken(newToken);
    if (newWorker) {
      setWorker(newWorker);
      await saveStoredWorker(newWorker);
    } else {
      await refreshWorker();
    }
  }, [refreshWorker]);

  const signOut = useCallback(async () => {
    await clearToken();
    await clearStoredWorker();
    setToken(null);
    setWorker(null);
  }, []);

  const needsWorkNumber = useMemo(
    () => !!worker?.work_number?.startsWith('G-'),
    [worker]
  );

  return (
    <AuthContext.Provider
      value={{ token, worker, isLoading, needsWorkNumber, signIn, signOut, refreshWorker }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

// Matches web's per-page role check (e.g. supervisor.js: "if (!['supervisor',
// 'admin'].includes(w?.role)) router.push('/dashboard')") - a role-gated
// screen redirects away once the worker is known, rather than relying only
// on there being no navigable link to it.
export function useRoleGuard(allowedRoles) {
  const { worker } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (worker && !allowedRoles.includes(worker.role)) {
      router.replace('/days');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worker?.role]);
}

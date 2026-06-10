import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import api from './api';

const TOKEN_KEY = 'rannikon_token';

export async function getToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function saveToken(token) {
  return SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken() {
  return SecureStore.deleteItemAsync(TOKEN_KEY);
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [worker, setWorker] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshWorker = useCallback(async () => {
    const { data } = await api.get('/api/auth/me');
    setWorker(data.worker);
    return data.worker;
  }, []);

  useEffect(() => {
    (async () => {
      const storedToken = await getToken();
      if (storedToken) {
        setToken(storedToken);
        try {
          await refreshWorker();
        } catch {
          await clearToken();
          setToken(null);
          setWorker(null);
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
    } else {
      await refreshWorker();
    }
  }, [refreshWorker]);

  const signOut = useCallback(async () => {
    await clearToken();
    setToken(null);
    setWorker(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ token, worker, isLoading, signIn, signOut, refreshWorker }}
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

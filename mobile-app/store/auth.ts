import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const DEFAULT_SERVER_URL = 'https://app.meisnerinteriors.com';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  serverUrl: string;
  isLoading: boolean;
  error: string | null;
  rememberMe: boolean;
  setToken: (token: string | null) => Promise<void>;
  setUser: (user: User | null) => void;
  setServerUrl: (url: string) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  setRememberMe: (remember: boolean) => void;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

// Platform-specific storage
const storage: StateStorage = {
  setItem: async (name: string, value: string) => {
    if (Platform.OS === 'web') {
      localStorage.setItem(name, value);
      return;
    }
    return SecureStore.setItemAsync(name, value);
  },
  getItem: async (name: string) => {
    if (Platform.OS === 'web') {
      return localStorage.getItem(name);
    }
    return SecureStore.getItemAsync(name);
  },
  removeItem: async (name: string) => {
    if (Platform.OS === 'web') {
      localStorage.removeItem(name);
      return;
    }
    return SecureStore.deleteItemAsync(name);
  },
};

const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      serverUrl: DEFAULT_SERVER_URL,
      isLoading: false,
      error: null,
      rememberMe: true,

      setToken: async (token: string | null) => {
        set({ token });
        if (token && get().rememberMe) {
          await storage.setItem('userToken', token);
        } else {
          await storage.removeItem('userToken');
        }
      },

      setUser: (user: User | null) => set({ user }),
      setServerUrl: (url: string) => set({ serverUrl: url }),
      setError: (error: string | null) => set({ error }),
      setLoading: (loading: boolean) => set({ isLoading: loading }),
      setRememberMe: (remember: boolean) => set({ rememberMe: remember }),

      login: async (email: string, password: string) => {
        const { serverUrl } = get();
        set({ isLoading: true, error: null });

        try {
          const response = await fetch(`${serverUrl}/api/auth/mobile-login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || 'Login failed');
          }

          await get().setToken(data.token);
          set({ user: data.user, isLoading: false });
          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Login failed';
          set({ error: message, isLoading: false });
          return false;
        }
      },

      logout: async () => {
        await get().setToken(null);
        set({ user: null, error: null, token: null });
        await storage.removeItem('userToken');
      },

      checkAuth: async () => {
        const { token, serverUrl, rememberMe } = get();
        
        // If not remembering, don't auto-login
        if (!rememberMe) {
          set({ token: null, user: null });
          return;
        }
        
        if (!token) return;

        set({ isLoading: true });

        try {
          const response = await fetch(`${serverUrl}/api/auth/me`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (!response.ok) {
            throw new Error('Session expired');
          }

          const data = await response.json();
          set({ user: data.user, isLoading: false });
        } catch (error) {
          await get().logout();
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({
        token: state.rememberMe ? state.token : null,
        user: state.rememberMe ? state.user : null,
        serverUrl: state.serverUrl,
        rememberMe: state.rememberMe,
      }),
    }
  )
);

export default useAuthStore;

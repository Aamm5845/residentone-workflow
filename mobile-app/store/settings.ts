import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsState {
  autoUpload: boolean;
  highQualityPhotos: boolean;
  includeGps: boolean;
  defaultProjectId: string | null;
  setAutoUpload: (value: boolean) => void;
  setHighQualityPhotos: (value: boolean) => void;
  setIncludeGps: (value: boolean) => void;
  setDefaultProjectId: (id: string | null) => void;
  loadSettings: () => Promise<void>;
}

const SETTINGS_KEY = 'app_settings';

export const useSettingsStore = create<SettingsState>((set, get) => ({
  autoUpload: true,
  highQualityPhotos: true,
  includeGps: true,
  defaultProjectId: null,

  setAutoUpload: async (value: boolean) => {
    set({ autoUpload: value });
    await saveSettings(get());
  },

  setHighQualityPhotos: async (value: boolean) => {
    set({ highQualityPhotos: value });
    await saveSettings(get());
  },

  setIncludeGps: async (value: boolean) => {
    set({ includeGps: value });
    await saveSettings(get());
  },

  setDefaultProjectId: async (id: string | null) => {
    set({ defaultProjectId: id });
    await saveSettings(get());
  },

  loadSettings: async () => {
    try {
      const data = await AsyncStorage.getItem(SETTINGS_KEY);
      if (data) {
        const settings = JSON.parse(data);
        set({
          autoUpload: settings.autoUpload ?? true,
          highQualityPhotos: settings.highQualityPhotos ?? true,
          includeGps: settings.includeGps ?? true,
          defaultProjectId: settings.defaultProjectId ?? null,
        });
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  },
}));

async function saveSettings(state: SettingsState) {
  try {
    await AsyncStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        autoUpload: state.autoUpload,
        highQualityPhotos: state.highQualityPhotos,
        includeGps: state.includeGps,
        defaultProjectId: state.defaultProjectId,
      })
    );
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

// Load settings on app start
useSettingsStore.getState().loadSettings();


import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { api } from '@/lib/api';

export interface PendingPhoto {
  id: string;
  uri: string;
  projectId: string;
  projectName: string;
  roomId?: string;
  roomName?: string;
  caption?: string;
  notes?: string;
  tags?: string[];
  gpsCoordinates?: { lat: number; lng: number };
  tradeCategory?: string;
  takenAt: string;
  status: 'pending' | 'uploading' | 'uploaded' | 'failed';
  error?: string;
  retryCount: number;
}

interface UploadState {
  pendingPhotos: PendingPhoto[];
  uploadingId: string | null;
  isUploading: boolean;
  uploadProgress: number;
  addPhoto: (photo: Omit<PendingPhoto, 'id' | 'status' | 'retryCount'>) => void;
  removePhoto: (id: string) => void;
  updatePhoto: (id: string, updates: Partial<PendingPhoto>) => void;
  uploadAll: () => Promise<void>;
  uploadPhoto: (id: string) => Promise<void>;
  retryUpload: (id: string) => Promise<void>;
  clearCompleted: () => void;
  loadFromStorage: () => Promise<void>;
  saveToStorage: () => Promise<void>;
}

const STORAGE_KEY = 'photo_upload_queue';

export const useUploadStore = create<UploadState>((set, get) => ({
  pendingPhotos: [],
  uploadingId: null,
  isUploading: false,
  uploadProgress: 0,

  addPhoto: (photo) => {
    const newPhoto: PendingPhoto = {
      ...photo,
      id: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
      retryCount: 0,
    };
    
    set((state) => ({
      pendingPhotos: [...state.pendingPhotos, newPhoto],
    }));
    
    // Save to persistent storage
    get().saveToStorage();
  },

  removePhoto: (id) => {
    set((state) => ({
      pendingPhotos: state.pendingPhotos.filter((p) => p.id !== id),
    }));
    get().saveToStorage();
  },

  updatePhoto: (id, updates) => {
    set((state) => ({
      pendingPhotos: state.pendingPhotos.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    }));
    get().saveToStorage();
  },

  uploadAll: async () => {
    const { pendingPhotos, uploadPhoto } = get();
    const pending = pendingPhotos.filter((p) => p.status === 'pending');
    
    if (pending.length === 0) return;
    
    set({ isUploading: true });
    
    for (let i = 0; i < pending.length; i++) {
      set({ uploadProgress: Math.round(((i + 1) / pending.length) * 100) });
      await uploadPhoto(pending[i].id);
    }
    
    set({ isUploading: false, uploadProgress: 0 });
  },

  uploadPhoto: async (id) => {
    const photo = get().pendingPhotos.find((p) => p.id === id);
    if (!photo) return;

    set({ uploadingId: id });
    get().updatePhoto(id, { status: 'uploading' });

    try {
      // First, create a project update if needed
      const updateResponse = await api.post<{ id: string }>(
        `/api/projects/${photo.projectId}/updates`,
        {
          type: 'PHOTO',
          category: 'PROGRESS',
          priority: 'MEDIUM',
          title: `Mobile Photo Survey - ${new Date().toLocaleDateString()}`,
          description: `Photo from mobile app`,
          roomId: photo.roomId,
          metadata: { source: 'mobile-app' },
        }
      );

      // Then upload the photo
      const formData = new FormData();
      
      // Read file info
      const fileInfo = await FileSystem.getInfoAsync(photo.uri);
      const filename = photo.uri.split('/').pop() || 'photo.jpg';
      
      formData.append('file', {
        uri: photo.uri,
        name: filename,
        type: 'image/jpeg',
      } as any);
      
      formData.append('projectId', photo.projectId);
      formData.append('updateId', updateResponse.id);
      
      if (photo.caption) formData.append('caption', photo.caption);
      if (photo.notes) formData.append('notes', photo.notes);
      if (photo.roomId) formData.append('roomId', photo.roomId);
      if (photo.tags) formData.append('tags', JSON.stringify(photo.tags));
      if (photo.gpsCoordinates) {
        formData.append('gpsCoordinates', JSON.stringify(photo.gpsCoordinates));
      }
      if (photo.tradeCategory) formData.append('tradeCategory', photo.tradeCategory);
      formData.append('takenAt', photo.takenAt);

      await api.uploadFile(
        `/api/projects/${photo.projectId}/updates/${updateResponse.id}/survey-photos`,
        formData
      );

      get().updatePhoto(id, { status: 'uploaded' });
    } catch (error) {
      console.error('Upload failed:', error);
      const retryCount = photo.retryCount + 1;
      get().updatePhoto(id, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Upload failed',
        retryCount,
      });
    } finally {
      set({ uploadingId: null });
    }
  },

  retryUpload: async (id) => {
    const photo = get().pendingPhotos.find((p) => p.id === id);
    if (!photo || photo.retryCount >= 3) return;
    
    get().updatePhoto(id, { status: 'pending' });
    await get().uploadPhoto(id);
  },

  clearCompleted: () => {
    set((state) => ({
      pendingPhotos: state.pendingPhotos.filter((p) => p.status !== 'uploaded'),
    }));
    get().saveToStorage();
  },

  loadFromStorage: async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        const photos = JSON.parse(data) as PendingPhoto[];
        // Reset uploading status for any photos that were uploading when app closed
        const resetPhotos = photos.map((p) => ({
          ...p,
          status: p.status === 'uploading' ? 'pending' : p.status,
        })) as PendingPhoto[];
        set({ pendingPhotos: resetPhotos });
      }
    } catch (e) {
      console.error('Failed to load upload queue:', e);
    }
  },

  saveToStorage: async () => {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(get().pendingPhotos)
      );
    } catch (e) {
      console.error('Failed to save upload queue:', e);
    }
  },
}));

// Load from storage on app start
useUploadStore.getState().loadFromStorage();


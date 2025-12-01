import { create } from 'zustand';
import { api } from '@/lib/api';
import { Project, Room } from '@/types';

interface ProjectState {
  projects: Project[];
  selectedProject: Project | null;
  rooms: Room[];
  isLoading: boolean;
  error: string | null;
  fetchProjects: () => Promise<void>;
  fetchRooms: (projectId: string) => Promise<void>;
  setSelectedProject: (project: Project | null) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  selectedProject: null,
  rooms: [],
  isLoading: false,
  error: null,

  fetchProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.get<Project[]>('/api/projects');
      set({ projects: data, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load projects',
        isLoading: false,
      });
    }
  },

  fetchRooms: async (projectId: string) => {
    try {
      const data = await api.get<Room[]>(`/api/projects/${projectId}/rooms`);
      set({ rooms: data });
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
      set({ rooms: [] });
    }
  },

  setSelectedProject: (project: Project | null) => {
    set({ selectedProject: project });
    if (project) {
      // Also fetch rooms for the selected project
      get().fetchRooms(project.id);
    } else {
      set({ rooms: [] });
    }
  },
}));


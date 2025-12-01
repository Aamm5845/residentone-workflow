import useAuthStore from '../store/auth';

class ApiClient {
  private getBaseUrl(): string {
    return useAuthStore.getState().serverUrl;
  }

  private getToken(): string | null {
    return useAuthStore.getState().token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const baseUrl = this.getBaseUrl();
    const token = this.getToken();

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  async uploadPhoto(
    projectId: string,
    updateId: string,
    photoData: {
      file: Blob;
      fileName: string;
      caption?: string;
      gpsCoordinates?: any;
      takenAt?: string;
      tags?: string[];
      roomArea?: string;
      tradeCategory?: string;
    }
  ): Promise<any> {
    const baseUrl = this.getBaseUrl();
    const token = this.getToken();

    const formData = new FormData();
    formData.append('file', photoData.file, photoData.fileName);
    if (photoData.caption) formData.append('caption', photoData.caption);
    if (photoData.gpsCoordinates) {
      formData.append('gpsCoordinates', JSON.stringify(photoData.gpsCoordinates));
    }
    if (photoData.takenAt) formData.append('takenAt', photoData.takenAt);
    if (photoData.tags) formData.append('tags', JSON.stringify(photoData.tags));
    if (photoData.roomArea) formData.append('roomArea', photoData.roomArea);
    if (photoData.tradeCategory) formData.append('tradeCategory', photoData.tradeCategory);

    const response = await fetch(
      `${baseUrl}/api/projects/${projectId}/updates/${updateId}/survey-photos`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || 'Upload failed');
    }

    return response.json();
  }

  // Project endpoints
  async getProjects(): Promise<{ projects: any[] }> {
    return this.get('/api/projects');
  }

  async getProject(id: string): Promise<any> {
    return this.get(`/api/projects/${id}`);
  }

  async getProjectRooms(projectId: string): Promise<any[]> {
    return this.get(`/api/projects/${projectId}/rooms`);
  }

  // Project updates endpoints
  async createProjectUpdate(
    projectId: string,
    data: {
      type: string;
      title: string;
      content?: string;
      visibility?: string;
    }
  ): Promise<any> {
    return this.post(`/api/projects/${projectId}/updates`, data);
  }

  async getProjectUpdates(projectId: string): Promise<any[]> {
    return this.get(`/api/projects/${projectId}/updates`);
  }
}

export const api = new ApiClient();
export default api;

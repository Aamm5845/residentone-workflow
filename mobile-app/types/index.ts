export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  address?: string;
  status: string;
  clientId?: string;
  client?: {
    id: string;
    name: string;
  };
  rooms?: Room[];
  createdAt: string;
  updatedAt: string;
}

export interface Room {
  id: string;
  name: string;
  projectId: string;
  roomSectionId?: string;
  roomSection?: {
    id: string;
    name: string;
  };
}

export interface CapturedPhoto {
  id: string;
  uri: string;
  caption?: string;
  notes?: string;
  tags?: string[];
  roomId?: string;
  customArea?: string;
  tradeCategory?: string;
  gpsCoordinates?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  takenAt: Date;
  uploaded: boolean;
  uploading: boolean;
  uploadError?: string;
  projectId?: string;
}

export interface UploadQueueItem {
  id: string;
  photo: CapturedPhoto;
  projectId: string;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  retryCount: number;
  error?: string;
}

export interface ProjectUpdate {
  id: string;
  projectId: string;
  type: string;
  title: string;
  content?: string;
  status: string;
  visibility: string;
  photos?: ProjectUpdatePhoto[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectUpdatePhoto {
  id: string;
  updateId: string;
  fileUrl: string;
  fileName: string;
  caption?: string;
  gpsCoordinates?: any;
  takenAt?: string;
  tags?: string[];
  roomArea?: string;
  tradeCategory?: string;
  annotationsData?: any;
}

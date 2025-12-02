import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';
import useAuthStore from '../../store/auth';
import { Project, Room } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_SIZE = (SCREEN_WIDTH - 56) / 3;

interface Photo {
  id: string;
  fileUrl: string;
  caption?: string;
  takenAt?: string;
  gpsCoordinates?: any;
  tags?: string[];
}

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { token, serverUrl } = useAuthStore();

  useEffect(() => {
    loadProject();
  }, [id]);

  const loadProject = async () => {
    try {
      setError(null);
      const data = await api.getProject(id!);
      setProject(data);
      
      // Load rooms if available
      try {
        const roomsData = await api.getProjectRooms(id!);
        setRooms(roomsData || []);
      } catch {
        // Rooms endpoint might not exist
      }
      
      // Load existing photos
      await loadPhotos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadPhotos = async () => {
    try {
      const response = await fetch(`${serverUrl}/api/mobile/projects/${id}/photos`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setPhotos(data.photos || []);
      }
    } catch (err) {
      console.error('Failed to load photos:', err);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadProject();
  };

  const handleStartCapture = () => {
    router.push({
      pathname: '/camera',
      params: { projectId: id, projectName: project?.name },
    });
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#7c3aed" />
        <Text style={styles.loadingText}>Loading project...</Text>
      </View>
    );
  }

  if (error || !project) {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.errorIcon}>
          <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
        </View>
        <Text style={styles.errorTitle}>Oops!</Text>
        <Text style={styles.errorText}>{error || 'Project not found'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadProject} activeOpacity={0.8}>
          <Ionicons name="refresh" size={22} color="#fff" />
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: project.name }} />
      <ScrollView 
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7c3aed']} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.projectIcon}>
            <Ionicons name="business" size={40} color="#7c3aed" />
          </View>
          <Text style={styles.projectName}>{project.name}</Text>
          {project.client && (
            <Text style={styles.clientName}>{project.client.name}</Text>
          )}
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(project.status) }]}>
            <Text style={styles.statusText}>{project.status}</Text>
          </View>
        </View>

        {/* Quick Actions - Big Buttons */}
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={styles.primaryButton} 
            onPress={handleStartCapture} 
            activeOpacity={0.8}
          >
            <View style={styles.buttonIconWrapper}>
              <Ionicons name="camera" size={32} color="#fff" />
            </View>
            <Text style={styles.primaryButtonText}>Take Photos</Text>
          </TouchableOpacity>
        </View>

        {/* Existing Photos Gallery */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="images" size={24} color="#7c3aed" />
            <Text style={styles.sectionTitle}>Project Photos</Text>
            <Text style={styles.photoCount}>{photos.length}</Text>
          </View>
          
          {photos.length > 0 ? (
            <View style={styles.photoGrid}>
              {photos.map((photo) => (
                <TouchableOpacity 
                  key={photo.id} 
                  style={styles.photoItem}
                  activeOpacity={0.8}
                >
                  <Image 
                    source={{ uri: photo.fileUrl }} 
                    style={styles.photoThumbnail}
                    resizeMode="cover"
                  />
                  {photo.caption && (
                    <View style={styles.photoCaptionBadge}>
                      <Text style={styles.photoCaptionText} numberOfLines={1}>
                        {photo.caption}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.emptyPhotos}>
              <View style={styles.emptyIcon}>
                <Ionicons name="images-outline" size={48} color="#d1d5db" />
              </View>
              <Text style={styles.emptyTitle}>No photos yet</Text>
              <Text style={styles.emptyText}>
                Tap "Take Photos" to start capturing
              </Text>
            </View>
          )}
        </View>

        {/* Address */}
        {project.address && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="location" size={24} color="#7c3aed" />
              <Text style={styles.sectionTitle}>Address</Text>
            </View>
            <Text style={styles.addressText}>{project.address}</Text>
          </View>
        )}

        {/* Rooms */}
        {rooms.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="grid" size={24} color="#7c3aed" />
              <Text style={styles.sectionTitle}>Rooms</Text>
              <Text style={styles.photoCount}>{rooms.length}</Text>
            </View>
            <View style={styles.roomsGrid}>
              {rooms.map((room) => (
                <View key={room.id} style={styles.roomChip}>
                  <Ionicons name="cube-outline" size={18} color="#7c3aed" />
                  <Text style={styles.roomName}>{room.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </>
  );
}

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'active':
      return '#dcfce7';
    case 'completed':
      return '#dbeafe';
    case 'on_hold':
      return '#fef3c7';
    default:
      return '#f3f4f6';
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  errorIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  errorText: {
    color: '#6b7280',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7c3aed',
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 17,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  projectIcon: {
    width: 88,
    height: 88,
    borderRadius: 22,
    backgroundColor: '#f3e8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  projectName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
  },
  clientName: {
    fontSize: 17,
    color: '#6b7280',
    marginTop: 6,
  },
  statusBadge: {
    marginTop: 14,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    textTransform: 'capitalize',
  },
  quickActions: {
    padding: 20,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
    paddingVertical: 24,
    borderRadius: 20,
    gap: 14,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 12,
    marginHorizontal: 16,
    padding: 20,
    borderRadius: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 19,
    fontWeight: '700',
    color: '#1f2937',
  },
  photoCount: {
    backgroundColor: '#f3e8ff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 15,
    fontWeight: '600',
    color: '#7c3aed',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoItem: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
  },
  photoThumbnail: {
    width: '100%',
    height: '100%',
  },
  photoCaptionBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  photoCaptionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  emptyPhotos: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 15,
    color: '#9ca3af',
  },
  addressText: {
    fontSize: 16,
    color: '#4b5563',
    lineHeight: 24,
  },
  roomsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  roomChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3e8ff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    gap: 8,
  },
  roomName: {
    fontSize: 15,
    color: '#7c3aed',
    fontWeight: '600',
  },
});

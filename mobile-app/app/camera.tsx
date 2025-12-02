import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Image,
  TextInput,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { CapturedPhoto } from '../types';
import useAuthStore from '../store/auth';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_SIZE = (SCREEN_WIDTH - 48) / 3;

export default function CameraScreen() {
  const { projectId, projectName } = useLocalSearchParams<{
    projectId: string;
    projectName: string;
  }>();

  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);
  const [currentCaption, setCurrentCaption] = useState('');
  const [currentNotes, setCurrentNotes] = useState('');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const { token, serverUrl } = useAuthStore();

  useEffect(() => {
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
    
    setHasPermission(cameraStatus === 'granted');

    if (locationStatus === 'granted') {
      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);
    }
  };

  const takePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        exif: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        
        let gpsCoordinates = undefined;
        if (location) {
          gpsCoordinates = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy || undefined,
          };
        }

        const newPhoto: CapturedPhoto = {
          id: Date.now().toString(),
          uri: asset.uri,
          caption: currentCaption,
          notes: currentNotes,
          gpsCoordinates,
          takenAt: new Date(),
          uploaded: false,
          uploading: false,
          projectId,
        };

        setCapturedPhotos([...capturedPhotos, newPhoto]);
        setCurrentCaption('');
        setCurrentNotes('');

        if (location) {
          Location.getCurrentPositionAsync({}).then(setLocation);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const pickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsMultipleSelection: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        const newPhotos = result.assets.map((asset) => ({
          id: Date.now().toString() + Math.random(),
          uri: asset.uri,
          caption: '',
          notes: '',
          gpsCoordinates: location ? {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy || undefined,
          } : undefined,
          takenAt: new Date(),
          uploaded: false,
          uploading: false,
          projectId,
        }));

        setCapturedPhotos([...capturedPhotos, ...newPhotos]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick photos');
    }
  };

  const removePhoto = (id: string) => {
    setCapturedPhotos(capturedPhotos.filter((p) => p.id !== id));
  };

  const uploadPhoto = async (photo: CapturedPhoto): Promise<boolean> => {
    try {
      const formData = new FormData();
      
      const response = await fetch(photo.uri);
      const blob = await response.blob();
      
      formData.append('file', blob, `photo_${Date.now()}.jpg`);
      formData.append('caption', photo.caption || '');
      
      if (photo.gpsCoordinates) {
        formData.append('gpsCoordinates', JSON.stringify({
          latitude: photo.gpsCoordinates.latitude,
          longitude: photo.gpsCoordinates.longitude,
        }));
      }
      
      formData.append('takenAt', photo.takenAt.toISOString());
      formData.append('tags', JSON.stringify(photo.tags || []));
      
      const uploadResponse = await fetch(`${serverUrl}/api/mobile/projects/${projectId}/photos`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });
      
      if (!uploadResponse.ok) {
        const error = await uploadResponse.json();
        throw new Error(error.error || 'Upload failed');
      }
      
      return true;
    } catch (error) {
      console.error('Upload error:', error);
      return false;
    }
  };

  const handleDone = async () => {
    if (capturedPhotos.length === 0) {
      router.back();
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < capturedPhotos.length; i++) {
      const photo = capturedPhotos[i];
      setUploadProgress(Math.round(((i + 1) / capturedPhotos.length) * 100));
      
      const success = await uploadPhoto(photo);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    }
    
    setIsUploading(false);
    
    if (failCount === 0) {
      Alert.alert(
        'Upload Complete',
        `${successCount} photo(s) uploaded successfully!`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } else {
      Alert.alert(
        'Upload Partial',
        `${successCount} uploaded, ${failCount} failed. Check your connection and try again.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    }
  };

  if (hasPermission === null) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#7c3aed" />
        <Text style={styles.loadingText}>Requesting permissions...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.permissionIcon}>
          <Ionicons name="camera-outline" size={64} color="#7c3aed" />
        </View>
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionText}>
          Please allow camera access to take photos for site surveys
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermissions}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()}
          style={styles.headerButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={28} color="#1f2937" />
        </TouchableOpacity>
        
        <View style={styles.headerTitle}>
          <Text style={styles.projectLabel}>Project</Text>
          <Text style={styles.projectName} numberOfLines={1}>{projectName}</Text>
        </View>
        
        <TouchableOpacity 
          onPress={handleDone}
          disabled={isUploading}
          style={[styles.uploadButton, capturedPhotos.length === 0 && styles.uploadButtonDisabled]}
          activeOpacity={0.7}
        >
          {isUploading ? (
            <View style={styles.uploadingContainer}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.uploadingText}>{uploadProgress}%</Text>
            </View>
          ) : (
            <Text style={styles.uploadButtonText}>
              {capturedPhotos.length > 0 ? `Upload ${capturedPhotos.length}` : 'Done'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Caption Input */}
        <View style={styles.captionSection}>
          <TextInput
            style={styles.captionInput}
            placeholder="Add caption for next photo..."
            placeholderTextColor="#9ca3af"
            value={currentCaption}
            onChangeText={setCurrentCaption}
          />
        </View>

        {/* Photo Grid */}
        {capturedPhotos.length > 0 ? (
          <View style={styles.photoGrid}>
            {capturedPhotos.map((photo) => (
              <TouchableOpacity 
                key={photo.id} 
                style={styles.photoItem}
                onPress={() => router.push({
                  pathname: '/annotate',
                  params: { 
                    photoUri: photo.uri, 
                    projectId, 
                    projectName 
                  }
                })}
                activeOpacity={0.8}
              >
                <Image source={{ uri: photo.uri }} style={styles.photoThumbnail} />
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removePhoto(photo.id)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close-circle" size={28} color="#ef4444" />
                </TouchableOpacity>
                {photo.gpsCoordinates && (
                  <View style={styles.gpsBadge}>
                    <Ionicons name="location" size={14} color="#fff" />
                  </View>
                )}
                <View style={styles.editBadge}>
                  <Ionicons name="create-outline" size={16} color="#fff" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="images-outline" size={80} color="#7c3aed" />
            </View>
            <Text style={styles.emptyTitle}>No photos yet</Text>
            <Text style={styles.emptyText}>
              Use the camera button below to capture photos{'\n'}or select from your gallery
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Camera Controls - Large Touch Targets */}
      <View style={styles.controls}>
        <TouchableOpacity 
          style={styles.controlButton} 
          onPress={pickFromGallery}
          activeOpacity={0.7}
        >
          <View style={styles.controlIconWrapper}>
            <Ionicons name="images" size={32} color="#7c3aed" />
          </View>
          <Text style={styles.controlLabel}>Gallery</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.captureButton} 
          onPress={takePhoto}
          activeOpacity={0.8}
        >
          <View style={styles.captureOuter}>
            <View style={styles.captureInner}>
              <Ionicons name="camera" size={40} color="#fff" />
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.photoCountContainer}>
          <View style={styles.photoCountBadge}>
            <Text style={styles.photoCountNumber}>{capturedPhotos.length}</Text>
          </View>
          <Text style={styles.controlLabel}>Photos</Text>
        </View>
      </View>
    </View>
  );
}

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
  permissionIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f3e8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  permissionButton: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 24,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 12,
  },
  headerButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
  },
  projectLabel: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  projectName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  uploadButton: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 100,
    alignItems: 'center',
  },
  uploadButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  uploadingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  captionSection: {
    padding: 16,
  },
  captionInput: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 8,
  },
  photoItem: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 12,
    overflow: 'hidden',
  },
  photoThumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e5e7eb',
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#fff',
    borderRadius: 14,
  },
  gpsBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: '#10b981',
    padding: 6,
    borderRadius: 6,
  },
  editBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: '#7c3aed',
    padding: 6,
    borderRadius: 6,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#f3e8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  controlButton: {
    alignItems: 'center',
    minWidth: 80,
  },
  controlIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f3e8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  controlLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  captureButton: {
    alignItems: 'center',
  },
  captureOuter: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  captureInner: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoCountContainer: {
    alignItems: 'center',
    minWidth: 80,
  },
  photoCountBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f3e8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  photoCountNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#7c3aed',
  },
});

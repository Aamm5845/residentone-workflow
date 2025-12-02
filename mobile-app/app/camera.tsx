import { useState, useRef, useEffect } from 'react';
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
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { CapturedPhoto } from '../types';

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
        
        // Get current location
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

        // Refresh location for next photo
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

  const handleDone = () => {
    if (capturedPhotos.length > 0) {
      // In a real app, add to upload queue here
      Alert.alert(
        'Photos Captured',
        `${capturedPhotos.length} photo(s) added to upload queue`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } else {
      router.back();
    }
  };

  if (hasPermission === null) {
    return (
      <View style={styles.centerContainer}>
        <Text>Requesting permissions...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="camera-outline" size={64} color="#d1d5db" />
        <Text style={styles.permissionText}>Camera permission is required</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermissions}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable 
          onPress={() => router.back()}
          style={({ pressed }) => [styles.headerButton, pressed && styles.headerButtonPressed]}
          accessibilityRole="button"
        >
          <Ionicons name="close" size={28} color="#1f2937" />
        </Pressable>
        <View style={styles.headerTitle}>
          <Text style={styles.projectLabel}>Project</Text>
          <Text style={styles.projectName}>{projectName}</Text>
        </View>
        <Pressable 
          onPress={handleDone}
          style={({ pressed }) => [styles.headerButton, pressed && styles.headerButtonPressed]}
          accessibilityRole="button"
        >
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.content}>
        {/* Quick caption input */}
        <View style={styles.captionSection}>
          <TextInput
            style={styles.captionInput}
            placeholder="Add caption for next photo..."
            placeholderTextColor="#9ca3af"
            value={currentCaption}
            onChangeText={setCurrentCaption}
          />
        </View>

        {/* Photo grid */}
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
            >
              <Image source={{ uri: photo.uri }} style={styles.photoThumbnail} />
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removePhoto(photo.id)}
              >
                <Ionicons name="close-circle" size={24} color="#ef4444" />
              </TouchableOpacity>
              {photo.gpsCoordinates && (
                <View style={styles.gpsBadge}>
                  <Ionicons name="location" size={12} color="#fff" />
                </View>
              )}
              <View style={styles.editBadge}>
                <Ionicons name="create-outline" size={14} color="#fff" />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {capturedPhotos.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="images-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>No photos captured yet</Text>
            <Text style={styles.emptySubtext}>
              Use the buttons below to take or select photos
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Camera controls */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.controlButton} onPress={pickFromGallery}>
          <Ionicons name="images" size={28} color="#7c3aed" />
          <Text style={styles.controlLabel}>Gallery</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.captureButton} onPress={takePhoto}>
          <View style={styles.captureInner}>
            <Ionicons name="camera" size={32} color="#fff" />
          </View>
        </TouchableOpacity>

        <View style={styles.photoCount}>
          <Text style={styles.photoCountNumber}>{capturedPhotos.length}</Text>
          <Text style={styles.controlLabel}>Photos</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 16,
    textAlign: 'center',
  },
  permissionButton: {
    marginTop: 20,
    backgroundColor: '#7c3aed',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerButton: {
    padding: 8,
    borderRadius: 8,
  },
  headerButtonPressed: {
    backgroundColor: '#f3f4f6',
  },
  headerTitle: {
    alignItems: 'center',
  },
  projectLabel: {
    fontSize: 12,
    color: '#9ca3af',
  },
  projectName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  doneText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7c3aed',
  },
  content: {
    flex: 1,
  },
  captionSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  captionInput: {
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
  photoItem: {
    width: '33.33%',
    aspectRatio: 1,
    padding: 4,
  },
  photoThumbnail: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  gpsBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: '#10b981',
    padding: 4,
    borderRadius: 4,
  },
  editBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: '#7c3aed',
    padding: 6,
    borderRadius: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  controlButton: {
    alignItems: 'center',
    width: 80,
  },
  controlLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoCount: {
    alignItems: 'center',
    width: 80,
  },
  photoCountNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#7c3aed',
  },
});

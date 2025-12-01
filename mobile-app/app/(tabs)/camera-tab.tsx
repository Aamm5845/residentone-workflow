import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';
import { Project } from '../../types';

export default function CameraTabScreen() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const data = await api.getProjects();
      setProjects(data.projects || []);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  const handleStartCapture = () => {
    if (!selectedProject) {
      Alert.alert('Select Project', 'Please select a project before capturing photos');
      return;
    }
    router.push({
      pathname: '/camera',
      params: { projectId: selectedProject.id, projectName: selectedProject.name },
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.cameraIconContainer}>
          <Ionicons name="camera" size={64} color="#7c3aed" />
        </View>
        <Text style={styles.title}>Photo Capture</Text>
        <Text style={styles.subtitle}>
          Select a project and start capturing site survey photos
        </Text>
      </View>

      <View style={styles.projectSection}>
        <Text style={styles.sectionTitle}>Select Project</Text>
        {selectedProject ? (
          <TouchableOpacity
            style={styles.selectedProject}
            onPress={() => setSelectedProject(null)}
          >
            <View style={styles.projectIcon}>
              <Ionicons name="business" size={20} color="#7c3aed" />
            </View>
            <View style={styles.projectInfo}>
              <Text style={styles.projectName}>{selectedProject.name}</Text>
              {selectedProject.client && (
                <Text style={styles.projectClient}>{selectedProject.client.name}</Text>
              )}
            </View>
            <Ionicons name="close-circle" size={24} color="#9ca3af" />
          </TouchableOpacity>
        ) : (
          <FlatList
            data={projects.slice(0, 5)}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.projectsList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.projectChip}
                onPress={() => setSelectedProject(item)}
              >
                <Ionicons name="business-outline" size={16} color="#7c3aed" />
                <Text style={styles.projectChipText} numberOfLines={1}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.noProjects}>No projects available</Text>
            }
          />
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[
            styles.captureButton,
            !selectedProject && styles.captureButtonDisabled,
          ]}
          onPress={handleStartCapture}
          disabled={!selectedProject}
        >
          <Ionicons name="camera" size={32} color="#fff" />
          <Text style={styles.captureButtonText}>Start Capture</Text>
        </TouchableOpacity>

        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickAction}>
            <Ionicons name="images-outline" size={24} color="#7c3aed" />
            <Text style={styles.quickActionText}>Gallery</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction}>
            <Ionicons name="document-text-outline" size={24} color="#7c3aed" />
            <Text style={styles.quickActionText}>Recent</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  cameraIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f3e8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  projectSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  selectedProject: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#7c3aed',
  },
  projectIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f3e8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  projectInfo: {
    flex: 1,
  },
  projectName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  projectClient: {
    fontSize: 14,
    color: '#6b7280',
  },
  projectsList: {
    gap: 10,
  },
  projectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    maxWidth: 150,
  },
  projectChipText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  noProjects: {
    color: '#9ca3af',
    fontSize: 14,
  },
  actions: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  captureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
    paddingVertical: 20,
    borderRadius: 16,
    gap: 12,
    marginBottom: 24,
  },
  captureButtonDisabled: {
    backgroundColor: '#a78bfa',
  },
  captureButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
  },
  quickAction: {
    alignItems: 'center',
    gap: 8,
  },
  quickActionText: {
    fontSize: 14,
    color: '#6b7280',
  },
});

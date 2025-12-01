import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface QueueItem {
  id: string;
  fileName: string;
  projectName: string;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  progress?: number;
}

export default function QueueScreen() {
  // Mock data for now - will be connected to real upload queue
  const queueItems: QueueItem[] = [];

  const getStatusIcon = (status: QueueItem['status']) => {
    switch (status) {
      case 'pending':
        return <Ionicons name="time-outline" size={20} color="#f59e0b" />;
      case 'uploading':
        return <Ionicons name="cloud-upload-outline" size={20} color="#3b82f6" />;
      case 'completed':
        return <Ionicons name="checkmark-circle" size={20} color="#10b981" />;
      case 'failed':
        return <Ionicons name="alert-circle" size={20} color="#ef4444" />;
    }
  };

  const renderQueueItem = ({ item }: { item: QueueItem }) => (
    <View style={styles.queueItem}>
      <View style={styles.thumbnail}>
        <Ionicons name="image-outline" size={24} color="#9ca3af" />
      </View>
      <View style={styles.itemInfo}>
        <Text style={styles.fileName}>{item.fileName}</Text>
        <Text style={styles.projectName}>{item.projectName}</Text>
        {item.status === 'uploading' && (
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${item.progress || 0}%` }]} />
          </View>
        )}
      </View>
      {getStatusIcon(item.status)}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Ionicons name="time-outline" size={20} color="#f59e0b" />
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="cloud-upload-outline" size={20} color="#3b82f6" />
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Uploading</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="checkmark-circle" size={20} color="#10b981" />
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
        </View>
      </View>

      <FlatList
        data={queueItems}
        keyExtractor={(item) => item.id}
        renderItem={renderQueueItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cloud-done-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>Upload Queue Empty</Text>
            <Text style={styles.emptySubtext}>
              Photos you capture will appear here before being uploaded
            </Text>
          </View>
        }
      />

      {queueItems.length > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.uploadAllButton}>
            <Ionicons name="cloud-upload" size={20} color="#fff" />
            <Text style={styles.uploadAllText}>Upload All</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  projectName: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
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
    paddingHorizontal: 32,
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  uploadAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  uploadAllText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

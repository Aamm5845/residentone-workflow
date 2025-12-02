import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
  ScrollView,
  Platform,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import useAuthStore from '../store/auth';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Tag {
  id: string;
  label: string;
  color: string;
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];
const TRADE_CATEGORIES = ['Electrical', 'Plumbing', 'HVAC', 'Flooring', 'Walls', 'Ceiling', 'Windows', 'Doors', 'Cabinetry', 'Countertops'];

export default function AnnotateScreen() {
  const params = useLocalSearchParams<{
    photoUri: string;
    projectId: string;
    projectName: string;
  }>();

  const [caption, setCaption] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<Tag[]>([]);
  const [tradeCategory, setTradeCategory] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTagText, setNewTagText] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const { token, serverUrl } = useAuthStore();

  const addTag = () => {
    if (newTagText.trim()) {
      setTags([...tags, {
        id: Date.now().toString(),
        label: newTagText.trim(),
        color: COLORS[tags.length % COLORS.length]
      }]);
      setNewTagText('');
      setShowTagInput(false);
    }
  };

  const removeTag = (id: string) => {
    setTags(tags.filter(t => t.id !== id));
  };

  const handleSave = async () => {
    setIsUploading(true);
    
    try {
      const formData = new FormData();
      
      // Get the file from the URI
      const response = await fetch(params.photoUri);
      const blob = await response.blob();
      
      formData.append('file', blob, `photo_${Date.now()}.jpg`);
      formData.append('caption', caption);
      formData.append('tags', JSON.stringify(tags.map(t => t.label)));
      formData.append('tradeCategory', tradeCategory);
      formData.append('takenAt', new Date().toISOString());
      
      if (notes) {
        formData.append('notes', notes);
      }
      
      const uploadResponse = await fetch(`${serverUrl}/api/mobile/projects/${params.projectId}/photos`, {
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
      
      const result = await uploadResponse.json();
      
      Alert.alert(
        '✅ Photo Saved!',
        result.dropboxPath 
          ? 'Photo uploaded to Dropbox and saved.' 
          : 'Photo saved to database.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert(
        'Upload Failed',
        error instanceof Error ? error.message : 'Could not save photo. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.headerButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit & Save</Text>
        <TouchableOpacity 
          onPress={handleSave} 
          style={styles.saveButton} 
          disabled={isUploading}
          activeOpacity={0.7}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color="#7c3aed" />
          ) : (
            <>
              <Ionicons name="cloud-upload" size={20} color="#7c3aed" />
              <Text style={styles.saveButtonText}>Save</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Photo Preview */}
        <View style={styles.photoContainer}>
          <Image
            source={{ uri: params.photoUri }}
            style={styles.photo}
            resizeMode="cover"
          />
        </View>

        {/* Caption - Large Input */}
        <View style={styles.inputSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="text" size={24} color="#7c3aed" />
            <Text style={styles.sectionTitle}>Caption</Text>
          </View>
          <TextInput
            style={styles.captionInput}
            placeholder="What's in this photo?"
            placeholderTextColor="#9ca3af"
            value={caption}
            onChangeText={setCaption}
            multiline
          />
        </View>

        {/* Tags - Easy to Add */}
        <View style={styles.inputSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="pricetags" size={24} color="#7c3aed" />
            <Text style={styles.sectionTitle}>Tags</Text>
          </View>
          <View style={styles.tagsContainer}>
            {tags.map((tag) => (
              <TouchableOpacity 
                key={tag.id} 
                style={[styles.tag, { backgroundColor: tag.color }]}
                onPress={() => removeTag(tag.id)}
                activeOpacity={0.7}
              >
                <Text style={styles.tagText}>{tag.label}</Text>
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            ))}
            <TouchableOpacity 
              style={styles.addTagButton} 
              onPress={() => setShowTagInput(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle" size={24} color="#7c3aed" />
              <Text style={styles.addTagText}>Add Tag</Text>
            </TouchableOpacity>
          </View>
          {showTagInput && (
            <View style={styles.tagInputRow}>
              <TextInput
                style={styles.tagInput}
                placeholder="Tag name..."
                placeholderTextColor="#9ca3af"
                value={newTagText}
                onChangeText={setNewTagText}
                autoFocus
                onSubmitEditing={addTag}
              />
              <TouchableOpacity 
                style={styles.tagSubmit} 
                onPress={addTag}
                activeOpacity={0.7}
              >
                <Ionicons name="checkmark" size={28} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.tagCancel} 
                onPress={() => {
                  setShowTagInput(false);
                  setNewTagText('');
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={28} color="#6b7280" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Trade Category - Large Chips */}
        <View style={styles.inputSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="construct" size={24} color="#7c3aed" />
            <Text style={styles.sectionTitle}>Trade Category</Text>
          </View>
          <View style={styles.categoryGrid}>
            {TRADE_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryChip, tradeCategory === cat && styles.categoryChipSelected]}
                onPress={() => setTradeCategory(tradeCategory === cat ? '' : cat)}
                activeOpacity={0.7}
              >
                <Text style={[styles.categoryChipText, tradeCategory === cat && styles.categoryChipTextSelected]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Notes */}
        <View style={styles.inputSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text" size={24} color="#7c3aed" />
            <Text style={styles.sectionTitle}>Notes</Text>
          </View>
          <TextInput
            style={styles.notesInput}
            placeholder="Additional notes about this photo..."
            placeholderTextColor="#9ca3af"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Big Save Button at Bottom */}
        <TouchableOpacity 
          style={styles.bigSaveButton} 
          onPress={handleSave}
          disabled={isUploading}
          activeOpacity={0.8}
        >
          {isUploading ? (
            <ActivityIndicator size="large" color="#fff" />
          ) : (
            <>
              <Ionicons name="cloud-upload" size={32} color="#fff" />
              <Text style={styles.bigSaveButtonText}>Save Photo</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#7c3aed',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  saveButtonText: {
    color: '#7c3aed',
    fontWeight: '700',
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  photoContainer: {
    backgroundColor: '#000',
  },
  photo: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.75,
  },
  inputSection: {
    backgroundColor: '#fff',
    padding: 20,
    marginTop: 12,
    marginHorizontal: 16,
    borderRadius: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  captionInput: {
    backgroundColor: '#f3f4f6',
    padding: 16,
    borderRadius: 14,
    fontSize: 17,
    color: '#1f2937',
    minHeight: 60,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  tagText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  addTagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#7c3aed',
    borderStyle: 'dashed',
    gap: 8,
  },
  addTagText: {
    color: '#7c3aed',
    fontSize: 16,
    fontWeight: '600',
  },
  tagInputRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 10,
  },
  tagInput: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    padding: 16,
    borderRadius: 14,
    fontSize: 17,
  },
  tagSubmit: {
    backgroundColor: '#7c3aed',
    width: 56,
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagCancel: {
    backgroundColor: '#f3f4f6',
    width: 56,
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryChip: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: '#f3f4f6',
  },
  categoryChipSelected: {
    backgroundColor: '#7c3aed',
  },
  categoryChipText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '600',
  },
  categoryChipTextSelected: {
    color: '#fff',
  },
  notesInput: {
    backgroundColor: '#f3f4f6',
    padding: 16,
    borderRadius: 14,
    fontSize: 17,
    color: '#1f2937',
    minHeight: 120,
    textAlignVertical: 'top',
  },
  bigSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 24,
    borderRadius: 20,
    gap: 12,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  bigSaveButtonText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
});

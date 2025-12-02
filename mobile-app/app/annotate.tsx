import { useState, useRef } from 'react';
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
import Svg, { Line, Circle, Text as SvgText, G } from 'react-native-svg';
import useAuthStore from '../store/auth';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Annotation {
  id: string;
  type: 'arrow' | 'circle' | 'text' | 'measurement';
  startX: number;
  startY: number;
  endX?: number;
  endY?: number;
  text?: string;
  color: string;
  measurementValue?: string;
}

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

  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [currentTool, setCurrentTool] = useState<'arrow' | 'circle' | 'text' | 'measurement' | null>(null);
  const [currentColor, setCurrentColor] = useState('#ef4444');
  const [caption, setCaption] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [tradeCategory, setTradeCategory] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTagText, setNewTagText] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [showMeasurementInput, setShowMeasurementInput] = useState(false);
  const [measurementValue, setMeasurementValue] = useState('');
  const [pendingMeasurement, setPendingMeasurement] = useState<Annotation | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { token, serverUrl } = useAuthStore();
  const imageRef = useRef<View>(null);

  const handleImagePress = (event: any) => {
    const { locationX, locationY } = event.nativeEvent;
    
    if (currentTool === 'text') {
      const newAnnotation: Annotation = {
        id: Date.now().toString(),
        type: 'text',
        startX: locationX,
        startY: locationY,
        text: 'Text',
        color: currentColor,
      };
      setAnnotations([...annotations, newAnnotation]);
      setCurrentTool(null);
    } else if (currentTool === 'circle') {
      const newAnnotation: Annotation = {
        id: Date.now().toString(),
        type: 'circle',
        startX: locationX,
        startY: locationY,
        color: currentColor,
      };
      setAnnotations([...annotations, newAnnotation]);
      setCurrentTool(null);
    } else if (!isDrawing && (currentTool === 'arrow' || currentTool === 'measurement')) {
      setIsDrawing(true);
      setDrawStart({ x: locationX, y: locationY });
    } else if (isDrawing && (currentTool === 'arrow' || currentTool === 'measurement')) {
      if (currentTool === 'measurement') {
        const newAnnotation: Annotation = {
          id: Date.now().toString(),
          type: 'measurement',
          startX: drawStart.x,
          startY: drawStart.y,
          endX: locationX,
          endY: locationY,
          color: currentColor,
          measurementValue: '',
        };
        setPendingMeasurement(newAnnotation);
        setShowMeasurementInput(true);
      } else {
        const newAnnotation: Annotation = {
          id: Date.now().toString(),
          type: 'arrow',
          startX: drawStart.x,
          startY: drawStart.y,
          endX: locationX,
          endY: locationY,
          color: currentColor,
        };
        setAnnotations([...annotations, newAnnotation]);
      }
      setIsDrawing(false);
      setCurrentTool(null);
    }
  };

  const handleMeasurementSubmit = () => {
    if (pendingMeasurement && measurementValue) {
      const annotation = { ...pendingMeasurement, measurementValue };
      setAnnotations([...annotations, annotation]);
    }
    setPendingMeasurement(null);
    setMeasurementValue('');
    setShowMeasurementInput(false);
  };

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

  const removeAnnotation = (id: string) => {
    setAnnotations(annotations.filter(a => a.id !== id));
  };

  const handleSave = async () => {
    setIsUploading(true);
    
    try {
      const formData = new FormData();
      
      const response = await fetch(params.photoUri);
      const blob = await response.blob();
      
      formData.append('file', blob, `photo_${Date.now()}.jpg`);
      formData.append('caption', caption);
      formData.append('tags', JSON.stringify(tags.map(t => t.label)));
      formData.append('tradeCategory', tradeCategory);
      formData.append('annotationsData', JSON.stringify(annotations));
      formData.append('takenAt', new Date().toISOString());
      
      if (selectedRoom) {
        formData.append('roomArea', selectedRoom);
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
        'Photo Saved!',
        result.dropboxPath 
          ? 'Photo uploaded to Dropbox and saved to database.' 
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

  const ToolButton = ({ tool, icon, label }: { tool: typeof currentTool; icon: string; label: string }) => (
    <TouchableOpacity
      style={[styles.toolButton, currentTool === tool && styles.toolButtonActive]}
      onPress={() => setCurrentTool(currentTool === tool ? null : tool)}
      activeOpacity={0.7}
    >
      <Ionicons name={icon as any} size={28} color={currentTool === tool ? '#fff' : '#374151'} />
      <Text style={[styles.toolLabel, currentTool === tool && styles.toolLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.headerButton}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Photo</Text>
        <TouchableOpacity 
          onPress={handleSave} 
          style={styles.saveButton} 
          disabled={isUploading}
          activeOpacity={0.7}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color="#7c3aed" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Photo with annotations */}
        <View style={styles.photoContainer}>
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={handleImagePress}
            ref={imageRef}
          >
            <Image
              source={{ uri: params.photoUri }}
              style={styles.photo}
              resizeMode="contain"
            />
            <Svg style={styles.annotationsOverlay}>
              {annotations.map((annotation) => {
                if (annotation.type === 'arrow' && annotation.endX && annotation.endY) {
                  return (
                    <G key={annotation.id}>
                      <Line
                        x1={annotation.startX}
                        y1={annotation.startY}
                        x2={annotation.endX}
                        y2={annotation.endY}
                        stroke={annotation.color}
                        strokeWidth="4"
                      />
                      <Circle
                        cx={annotation.endX}
                        cy={annotation.endY}
                        r="8"
                        fill={annotation.color}
                      />
                    </G>
                  );
                }
                if (annotation.type === 'circle') {
                  return (
                    <Circle
                      key={annotation.id}
                      cx={annotation.startX}
                      cy={annotation.startY}
                      r="35"
                      stroke={annotation.color}
                      strokeWidth="4"
                      fill="transparent"
                    />
                  );
                }
                if (annotation.type === 'text') {
                  return (
                    <SvgText
                      key={annotation.id}
                      x={annotation.startX}
                      y={annotation.startY}
                      fill={annotation.color}
                      fontSize="18"
                      fontWeight="bold"
                    >
                      {annotation.text}
                    </SvgText>
                  );
                }
                if (annotation.type === 'measurement' && annotation.endX && annotation.endY) {
                  const midX = (annotation.startX + annotation.endX) / 2;
                  const midY = (annotation.startY + annotation.endY) / 2;
                  return (
                    <G key={annotation.id}>
                      <Line
                        x1={annotation.startX}
                        y1={annotation.startY}
                        x2={annotation.endX}
                        y2={annotation.endY}
                        stroke={annotation.color}
                        strokeWidth="3"
                        strokeDasharray="8,4"
                      />
                      <Circle cx={annotation.startX} cy={annotation.startY} r="6" fill={annotation.color} />
                      <Circle cx={annotation.endX} cy={annotation.endY} r="6" fill={annotation.color} />
                      <SvgText
                        x={midX}
                        y={midY - 12}
                        fill={annotation.color}
                        fontSize="16"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {annotation.measurementValue}
                      </SvgText>
                    </G>
                  );
                }
                return null;
              })}
            </Svg>
          </TouchableOpacity>
          
          {currentTool && (
            <View style={styles.toolHint}>
              <Text style={styles.toolHintText}>
                {currentTool === 'arrow' && (isDrawing ? '👆 Tap end point' : '👆 Tap start point')}
                {currentTool === 'circle' && '👆 Tap to place circle'}
                {currentTool === 'text' && '👆 Tap to add text'}
                {currentTool === 'measurement' && (isDrawing ? '👆 Tap end point' : '👆 Tap start point')}
              </Text>
            </View>
          )}
        </View>

        {/* Tools - Large Touch Targets */}
        <View style={styles.toolsSection}>
          <Text style={styles.sectionTitle}>Annotation Tools</Text>
          <View style={styles.toolsRow}>
            <ToolButton tool="arrow" icon="arrow-forward" label="Arrow" />
            <ToolButton tool="circle" icon="ellipse-outline" label="Circle" />
            <ToolButton tool="text" icon="text" label="Text" />
            <ToolButton tool="measurement" icon="resize" label="Measure" />
          </View>
          
          {/* Color picker - Large buttons */}
          <View style={styles.colorPicker}>
            {COLORS.map((color) => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorOption,
                  { backgroundColor: color },
                  currentColor === color && styles.colorOptionSelected
                ]}
                onPress={() => setCurrentColor(color)}
                activeOpacity={0.7}
              />
            ))}
          </View>
        </View>

        {/* Caption */}
        <View style={styles.inputSection}>
          <Text style={styles.sectionTitle}>Caption</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Add a caption..."
            placeholderTextColor="#9ca3af"
            value={caption}
            onChangeText={setCaption}
          />
        </View>

        {/* Tags */}
        <View style={styles.inputSection}>
          <Text style={styles.sectionTitle}>Tags</Text>
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
              <Ionicons name="add" size={22} color="#7c3aed" />
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
              />
              <TouchableOpacity 
                style={styles.tagSubmit} 
                onPress={addTag}
                activeOpacity={0.7}
              >
                <Ionicons name="checkmark" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Trade Category - Large chips */}
        <View style={styles.inputSection}>
          <Text style={styles.sectionTitle}>Trade Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.categoryRow}>
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
          </ScrollView>
        </View>

        {/* Notes */}
        <View style={styles.inputSection}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <TextInput
            style={[styles.textInput, styles.notesInput]}
            placeholder="Add notes..."
            placeholderTextColor="#9ca3af"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Annotations list */}
        {annotations.length > 0 && (
          <View style={styles.inputSection}>
            <Text style={styles.sectionTitle}>Annotations ({annotations.length})</Text>
            {annotations.map((annotation) => (
              <TouchableOpacity 
                key={annotation.id} 
                style={styles.annotationItem}
                onPress={() => removeAnnotation(annotation.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.annotationColor, { backgroundColor: annotation.color }]} />
                <Text style={styles.annotationLabel}>
                  {annotation.type === 'measurement' 
                    ? `📏 ${annotation.measurementValue}`
                    : annotation.type.charAt(0).toUpperCase() + annotation.type.slice(1)}
                </Text>
                <Ionicons name="trash-outline" size={22} color="#ef4444" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Measurement input modal */}
      {showMeasurementInput && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Enter Measurement</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g., 12 ft, 3.5 m"
              placeholderTextColor="#9ca3af"
              value={measurementValue}
              onChangeText={setMeasurementValue}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalCancel} 
                onPress={() => {
                  setShowMeasurementInput(false);
                  setPendingMeasurement(null);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalSubmit} 
                onPress={handleMeasurementSubmit}
                activeOpacity={0.7}
              >
                <Text style={styles.modalSubmitText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
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
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 80,
    alignItems: 'center',
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
    position: 'relative',
  },
  photo: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.75,
  },
  annotationsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  toolHint: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  toolHintText: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    color: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    fontSize: 16,
    fontWeight: '500',
  },
  toolsSection: {
    backgroundColor: '#fff',
    padding: 20,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 16,
  },
  toolsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  toolButton: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    flex: 1,
    marginHorizontal: 4,
  },
  toolButtonActive: {
    backgroundColor: '#7c3aed',
  },
  toolLabel: {
    fontSize: 13,
    color: '#374151',
    marginTop: 6,
    fontWeight: '500',
  },
  toolLabelActive: {
    color: '#fff',
  },
  colorPicker: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  colorOptionSelected: {
    borderWidth: 4,
    borderColor: '#1f2937',
  },
  inputSection: {
    backgroundColor: '#fff',
    padding: 20,
    marginTop: 8,
  },
  textInput: {
    backgroundColor: '#f3f4f6',
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  notesInput: {
    height: 120,
    textAlignVertical: 'top',
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
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  tagText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  addTagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#7c3aed',
    borderStyle: 'dashed',
    gap: 6,
  },
  addTagText: {
    color: '#7c3aed',
    fontSize: 15,
    fontWeight: '600',
  },
  tagInputRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  tagInput: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
  },
  tagSubmit: {
    backgroundColor: '#7c3aed',
    padding: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  categoryChip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: '#f3f4f6',
  },
  categoryChipSelected: {
    backgroundColor: '#7c3aed',
  },
  categoryChipText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  categoryChipTextSelected: {
    color: '#fff',
  },
  annotationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    marginBottom: 10,
    gap: 12,
  },
  annotationColor: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  annotationLabel: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#fff',
    padding: 28,
    borderRadius: 20,
    width: '85%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#f3f4f6',
    padding: 16,
    borderRadius: 12,
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancel: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 16,
  },
  modalSubmit: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
  },
  modalSubmitText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});

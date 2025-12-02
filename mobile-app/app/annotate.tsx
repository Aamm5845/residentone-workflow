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
  Modal,
  PanResponder,
  GestureResponderEvent,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import useAuthStore from '../store/auth';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_HEIGHT = SCREEN_WIDTH * 0.8;

type AnnotationType = 'marker' | 'arrow' | 'text' | 'measurement';

interface Annotation {
  id: string;
  type: AnnotationType;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  text?: string;
  color: string;
}

interface Tag {
  id: string;
  label: string;
  color: string;
}

const COLORS = ['#ef4444', '#f97316', '#22c55e', '#3b82f6', '#8b5cf6', '#000000'];
const TRADE_CATEGORIES = ['Electrical', 'Plumbing', 'HVAC', 'Flooring', 'Walls', 'Ceiling', 'Windows', 'Doors'];

export default function AnnotateScreen() {
  const params = useLocalSearchParams<{
    photoUri: string;
    projectId: string;
    projectName: string;
  }>();

  // Annotation state
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [currentTool, setCurrentTool] = useState<AnnotationType | null>(null);
  const [currentColor, setCurrentColor] = useState('#ef4444');
  const [isDrawingLine, setIsDrawingLine] = useState(false);
  const [lineStart, setLineStart] = useState({ x: 0, y: 0 });
  
  // Text/Measurement input modals
  const [showTextInput, setShowTextInput] = useState(false);
  const [showMeasureInput, setShowMeasureInput] = useState(false);
  const [pendingAnnotation, setPendingAnnotation] = useState<Annotation | null>(null);
  const [inputText, setInputText] = useState('');
  
  // Photo metadata
  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState<Tag[]>([]);
  const [tradeCategory, setTradeCategory] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTagText, setNewTagText] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const { token, serverUrl } = useAuthStore();
  const imageContainerRef = useRef<View>(null);

  const handleImagePress = (event: GestureResponderEvent) => {
    if (!currentTool) return;
    
    const { locationX, locationY } = event.nativeEvent;
    
    if (currentTool === 'marker') {
      // Add marker immediately
      const newAnnotation: Annotation = {
        id: Date.now().toString(),
        type: 'marker',
        x: locationX,
        y: locationY,
        color: currentColor,
      };
      setAnnotations([...annotations, newAnnotation]);
      
    } else if (currentTool === 'text') {
      // Show text input modal
      setPendingAnnotation({
        id: Date.now().toString(),
        type: 'text',
        x: locationX,
        y: locationY,
        color: currentColor,
      });
      setInputText('');
      setShowTextInput(true);
      
    } else if (currentTool === 'arrow' || currentTool === 'measurement') {
      if (!isDrawingLine) {
        // First tap - start line
        setIsDrawingLine(true);
        setLineStart({ x: locationX, y: locationY });
      } else {
        // Second tap - end line
        if (currentTool === 'measurement') {
          setPendingAnnotation({
            id: Date.now().toString(),
            type: 'measurement',
            x: lineStart.x,
            y: lineStart.y,
            x2: locationX,
            y2: locationY,
            color: currentColor,
          });
          setInputText('');
          setShowMeasureInput(true);
        } else {
          const newAnnotation: Annotation = {
            id: Date.now().toString(),
            type: 'arrow',
            x: lineStart.x,
            y: lineStart.y,
            x2: locationX,
            y2: locationY,
            color: currentColor,
          };
          setAnnotations([...annotations, newAnnotation]);
        }
        setIsDrawingLine(false);
      }
    }
  };

  const addTextAnnotation = () => {
    if (pendingAnnotation && inputText.trim()) {
      setAnnotations([...annotations, { ...pendingAnnotation, text: inputText.trim() }]);
    }
    setShowTextInput(false);
    setPendingAnnotation(null);
    setInputText('');
  };

  const addMeasurement = () => {
    if (pendingAnnotation && inputText.trim()) {
      setAnnotations([...annotations, { ...pendingAnnotation, text: inputText.trim() }]);
    }
    setShowMeasureInput(false);
    setPendingAnnotation(null);
    setInputText('');
  };

  const removeAnnotation = (id: string) => {
    setAnnotations(annotations.filter(a => a.id !== id));
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
      
      const uploadResponse = await fetch(`${serverUrl}/api/mobile/projects/${params.projectId}/photos`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      
      if (!uploadResponse.ok) {
        const error = await uploadResponse.json();
        throw new Error(error.error || 'Upload failed');
      }
      
      Alert.alert('✅ Saved!', 'Photo saved successfully', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const renderAnnotation = (annotation: Annotation) => {
    switch (annotation.type) {
      case 'marker':
        return (
          <TouchableOpacity
            key={annotation.id}
            style={[styles.marker, { left: annotation.x - 20, top: annotation.y - 40, borderColor: annotation.color }]}
            onLongPress={() => removeAnnotation(annotation.id)}
          >
            <Ionicons name="location" size={40} color={annotation.color} />
          </TouchableOpacity>
        );
      
      case 'text':
        return (
          <TouchableOpacity
            key={annotation.id}
            style={[styles.textAnnotation, { left: annotation.x, top: annotation.y, backgroundColor: annotation.color }]}
            onLongPress={() => removeAnnotation(annotation.id)}
          >
            <Text style={styles.textAnnotationText}>{annotation.text}</Text>
          </TouchableOpacity>
        );
      
      case 'arrow':
        if (!annotation.x2 || !annotation.y2) return null;
        const angle = Math.atan2(annotation.y2 - annotation.y, annotation.x2 - annotation.x) * 180 / Math.PI;
        const length = Math.sqrt(Math.pow(annotation.x2 - annotation.x, 2) + Math.pow(annotation.y2 - annotation.y, 2));
        return (
          <TouchableOpacity
            key={annotation.id}
            style={[
              styles.arrow,
              {
                left: annotation.x,
                top: annotation.y,
                width: length,
                backgroundColor: annotation.color,
                transform: [{ rotate: `${angle}deg` }],
                transformOrigin: 'left center',
              }
            ]}
            onLongPress={() => removeAnnotation(annotation.id)}
          >
            <View style={[styles.arrowHead, { borderLeftColor: annotation.color }]} />
          </TouchableOpacity>
        );
      
      case 'measurement':
        if (!annotation.x2 || !annotation.y2) return null;
        const mAngle = Math.atan2(annotation.y2 - annotation.y, annotation.x2 - annotation.x) * 180 / Math.PI;
        const mLength = Math.sqrt(Math.pow(annotation.x2 - annotation.x, 2) + Math.pow(annotation.y2 - annotation.y, 2));
        const midX = (annotation.x + annotation.x2) / 2;
        const midY = (annotation.y + annotation.y2) / 2;
        return (
          <View key={annotation.id}>
            <TouchableOpacity
              style={[
                styles.measureLine,
                {
                  left: annotation.x,
                  top: annotation.y,
                  width: mLength,
                  borderColor: annotation.color,
                  transform: [{ rotate: `${mAngle}deg` }],
                  transformOrigin: 'left center',
                }
              ]}
              onLongPress={() => removeAnnotation(annotation.id)}
            />
            <View style={[styles.measureDot, { left: annotation.x - 6, top: annotation.y - 6, backgroundColor: annotation.color }]} />
            <View style={[styles.measureDot, { left: annotation.x2 - 6, top: annotation.y2 - 6, backgroundColor: annotation.color }]} />
            <View style={[styles.measureLabel, { left: midX - 40, top: midY - 30, backgroundColor: annotation.color }]}>
              <Text style={styles.measureLabelText}>{annotation.text}</Text>
            </View>
          </View>
        );
      
      default:
        return null;
    }
  };

  const ToolButton = ({ tool, icon, label }: { tool: AnnotationType; icon: string; label: string }) => (
    <TouchableOpacity
      style={[styles.toolButton, currentTool === tool && styles.toolButtonActive]}
      onPress={() => {
        setCurrentTool(currentTool === tool ? null : tool);
        setIsDrawingLine(false);
      }}
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
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Annotate Photo</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveBtn} disabled={isUploading}>
          {isUploading ? (
            <ActivityIndicator size="small" color="#7c3aed" />
          ) : (
            <Text style={styles.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Photo with Annotations */}
        <View style={styles.photoSection}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={handleImagePress}
            style={styles.imageContainer}
            ref={imageContainerRef}
          >
            <Image source={{ uri: params.photoUri }} style={styles.photo} resizeMode="contain" />
            {annotations.map(renderAnnotation)}
            
            {/* Drawing indicator */}
            {isDrawingLine && (
              <View style={[styles.drawingDot, { left: lineStart.x - 8, top: lineStart.y - 8, backgroundColor: currentColor }]} />
            )}
          </TouchableOpacity>
          
          {/* Tool hint */}
          {currentTool && (
            <View style={styles.toolHint}>
              <Text style={styles.toolHintText}>
                {currentTool === 'marker' && '👆 Tap to place marker'}
                {currentTool === 'text' && '👆 Tap to add text'}
                {currentTool === 'arrow' && (isDrawingLine ? '👆 Tap end point' : '👆 Tap start point')}
                {currentTool === 'measurement' && (isDrawingLine ? '👆 Tap end point' : '👆 Tap start point')}
              </Text>
            </View>
          )}
        </View>

        {/* Annotation Tools - Big Touch Targets */}
        <View style={styles.toolsCard}>
          <Text style={styles.cardTitle}>✏️ Annotation Tools</Text>
          <View style={styles.toolsGrid}>
            <ToolButton tool="marker" icon="location" label="Marker" />
            <ToolButton tool="arrow" icon="arrow-forward" label="Arrow" />
            <ToolButton tool="text" icon="text" label="Text" />
            <ToolButton tool="measurement" icon="resize" label="Measure" />
          </View>
          
          {/* Colors */}
          <View style={styles.colorsRow}>
            {COLORS.map((color) => (
              <TouchableOpacity
                key={color}
                style={[styles.colorBtn, { backgroundColor: color }, currentColor === color && styles.colorBtnActive]}
                onPress={() => setCurrentColor(color)}
              />
            ))}
          </View>
          
          {/* Clear button */}
          {annotations.length > 0 && (
            <TouchableOpacity style={styles.clearBtn} onPress={() => setAnnotations([])}>
              <Ionicons name="trash-outline" size={20} color="#ef4444" />
              <Text style={styles.clearBtnText}>Clear All ({annotations.length})</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Caption */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📝 Caption</Text>
          <TextInput
            style={styles.input}
            placeholder="Describe this photo..."
            placeholderTextColor="#9ca3af"
            value={caption}
            onChangeText={setCaption}
            multiline
          />
        </View>

        {/* Tags */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🏷️ Tags</Text>
          <View style={styles.tagsWrap}>
            {tags.map((tag) => (
              <TouchableOpacity key={tag.id} style={[styles.tag, { backgroundColor: tag.color }]} onPress={() => setTags(tags.filter(t => t.id !== tag.id))}>
                <Text style={styles.tagText}>{tag.label}</Text>
                <Ionicons name="close" size={16} color="#fff" />
              </TouchableOpacity>
            ))}
            {!showTagInput ? (
              <TouchableOpacity style={styles.addTagBtn} onPress={() => setShowTagInput(true)}>
                <Ionicons name="add" size={20} color="#7c3aed" />
                <Text style={styles.addTagText}>Add</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.tagInputRow}>
                <TextInput style={styles.tagInput} placeholder="Tag..." value={newTagText} onChangeText={setNewTagText} autoFocus />
                <TouchableOpacity style={styles.tagSubmitBtn} onPress={addTag}>
                  <Ionicons name="checkmark" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Trade Category */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🔧 Trade</Text>
          <View style={styles.chipsWrap}>
            {TRADE_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, tradeCategory === cat && styles.chipActive]}
                onPress={() => setTradeCategory(tradeCategory === cat ? '' : cat)}
              >
                <Text style={[styles.chipText, tradeCategory === cat && styles.chipTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity style={styles.bigSaveBtn} onPress={handleSave} disabled={isUploading}>
          {isUploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="cloud-upload" size={28} color="#fff" />
              <Text style={styles.bigSaveBtnText}>Save Photo</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Text Input Modal */}
      <Modal visible={showTextInput} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Add Text</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter text..."
              value={inputText}
              onChangeText={setInputText}
              autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowTextInput(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={addTextAnnotation}>
                <Text style={styles.modalConfirmText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Measurement Input Modal */}
      <Modal visible={showMeasureInput} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>📏 Enter Measurement</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 12 ft, 3.5 m"
              value={inputText}
              onChangeText={setInputText}
              autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowMeasureInput(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={addMeasurement}>
                <Text style={styles.modalConfirmText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f0f0' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#7c3aed', paddingTop: Platform.OS === 'ios' ? 56 : 36, paddingBottom: 14, paddingHorizontal: 16 },
  headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  saveBtn: { backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  saveBtnText: { color: '#7c3aed', fontWeight: '700', fontSize: 15 },
  content: { flex: 1 },
  photoSection: { backgroundColor: '#000' },
  imageContainer: { width: SCREEN_WIDTH, height: PHOTO_HEIGHT, position: 'relative' },
  photo: { width: '100%', height: '100%' },
  toolHint: { position: 'absolute', bottom: 12, left: 12, right: 12, alignItems: 'center' },
  toolHintText: { backgroundColor: 'rgba(0,0,0,0.8)', color: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, fontSize: 15, fontWeight: '500' },
  drawingDot: { position: 'absolute', width: 16, height: 16, borderRadius: 8 },
  
  // Annotations
  marker: { position: 'absolute' },
  textAnnotation: { position: 'absolute', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  textAnnotationText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  arrow: { position: 'absolute', height: 4, borderRadius: 2 },
  arrowHead: { position: 'absolute', right: -8, top: -6, width: 0, height: 0, borderTopWidth: 8, borderBottomWidth: 8, borderLeftWidth: 12, borderTopColor: 'transparent', borderBottomColor: 'transparent' },
  measureLine: { position: 'absolute', height: 0, borderWidth: 2, borderStyle: 'dashed' },
  measureDot: { position: 'absolute', width: 12, height: 12, borderRadius: 6 },
  measureLabel: { position: 'absolute', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, minWidth: 80, alignItems: 'center' },
  measureLabelText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  
  // Tools Card
  toolsCard: { backgroundColor: '#fff', margin: 12, padding: 16, borderRadius: 16 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#1f2937', marginBottom: 14 },
  toolsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  toolButton: { flex: 1, alignItems: 'center', paddingVertical: 14, marginHorizontal: 4, borderRadius: 12, backgroundColor: '#f3f4f6' },
  toolButtonActive: { backgroundColor: '#7c3aed' },
  toolLabel: { fontSize: 12, color: '#374151', marginTop: 4, fontWeight: '500' },
  toolLabelActive: { color: '#fff' },
  colorsRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 12 },
  colorBtn: { width: 36, height: 36, borderRadius: 18 },
  colorBtnActive: { borderWidth: 3, borderColor: '#1f2937' },
  clearBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 6 },
  clearBtnText: { color: '#ef4444', fontWeight: '600' },
  
  // Cards
  card: { backgroundColor: '#fff', marginHorizontal: 12, marginTop: 12, padding: 16, borderRadius: 16 },
  input: { backgroundColor: '#f3f4f6', padding: 14, borderRadius: 10, fontSize: 16, minHeight: 50 },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, gap: 6 },
  tagText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  addTagBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 2, borderColor: '#7c3aed', borderStyle: 'dashed', gap: 4 },
  addTagText: { color: '#7c3aed', fontSize: 14, fontWeight: '600' },
  tagInputRow: { flexDirection: 'row', gap: 8, flex: 1 },
  tagInput: { flex: 1, backgroundColor: '#f3f4f6', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, fontSize: 15 },
  tagSubmitBtn: { backgroundColor: '#7c3aed', width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20, backgroundColor: '#f3f4f6' },
  chipActive: { backgroundColor: '#7c3aed' },
  chipText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  chipTextActive: { color: '#fff' },
  
  // Big Save
  bigSaveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#7c3aed', marginHorizontal: 12, marginTop: 20, paddingVertical: 20, borderRadius: 16, gap: 10 },
  bigSaveBtnText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modal: { backgroundColor: '#fff', width: '85%', padding: 24, borderRadius: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  modalInput: { backgroundColor: '#f3f4f6', padding: 16, borderRadius: 12, fontSize: 18, textAlign: 'center', marginBottom: 20 },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#f3f4f6', alignItems: 'center' },
  modalCancelText: { color: '#374151', fontWeight: '600', fontSize: 16 },
  modalConfirmBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#7c3aed', alignItems: 'center' },
  modalConfirmText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});

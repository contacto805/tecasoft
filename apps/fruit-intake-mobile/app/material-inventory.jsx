import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  StyleSheet, 
  Alert, 
  TextInput,
  KeyboardAvoidingView,
  Platform
} from 'react-native';

export default function MaterialInventory() {
  // Real-time keyboard input state - captures each character
  const [materialName, setMaterialName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [notes, setNotes] = useState('');
  
  // Custom materials list created by user from scratch
  const [customMaterials, setCustomMaterials] = useState([]);
  
  // Track if user is currently typing (real-time capture indicator)
  const [isTyping, setIsTyping] = useState(false);

  // Real-time character capture handler
  const handleMaterialNameChange = (text) => {
    setMaterialName(text);
    setIsTyping(true);
    
    // Log each character in real-time for debugging
    console.log('Real-time keyboard input:', text);
    
    // Clear typing indicator after 500ms of no input
    setTimeout(() => setIsTyping(false), 500);
  };

  // Clear ALL existing materials from inventory display
  const handleClearAll = () => {
    Alert.alert(
      'Limpiar Todo',
      '¿Estás seguro de eliminar todos los materiales del inventario?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Limpiar Todo',
          style: 'destructive',
          onPress: () => {
            setCustomMaterials([]);
            setMaterialName('');
            setQuantity('');
            setUnit('');
            setNotes('');
            Alert.alert('✅ Inventario Limpiado', 'Todos los materiales han sido eliminados');
          },
        },
      ]
    );
  };

  // Add new custom material to inventory
  const handleAddMaterial = () => {
    if (!materialName.trim()) {
      Alert.alert('Error', 'Por favor ingresa el nombre del material');
      return;
    }

    if (!quantity.trim()) {
      Alert.alert('Error', 'Por favor ingresa la cantidad');
      return;
    }

    const newMaterial = {
      id: Date.now(),
      name: materialName.trim(),
      quantity: parseFloat(quantity) || 0,
      unit: unit.trim() || 'unidades',
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
    };

    setCustomMaterials([newMaterial, ...customMaterials]);
    
    // Clear input fields after adding
    setMaterialName('');
    setQuantity('');
    setUnit('');
    setNotes('');
    
    Alert.alert('✅ Material Agregado', `${newMaterial.name} ha sido agregado al inventario`);
  };

  // Remove individual material
  const handleRemoveMaterial = (id) => {
    const material = customMaterials.find(m => m.id === id);
    Alert.alert(
      'Eliminar Material',
      `¿Deseas eliminar "${material.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setCustomMaterials(customMaterials.filter(m => m.id !== id));
          },
        },
      ]
    );
  };

  // Calculate total materials count
  const totalMaterials = customMaterials.length;
  const totalQuantity = customMaterials.reduce((sum, m) => sum + m.quantity, 0);

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Text style={styles.title}>📦 Inventario de Materiales</Text>
        <Text style={styles.subtitle}>Crea tu lista personalizada</Text>
      </View>

      {/* Stats and Clear All Button */}
      <View style={styles.statsContainer}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Total Materiales</Text>
          <Text style={styles.statValue}>{totalMaterials}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Cantidad Total</Text>
          <Text style={styles.statValue}>{totalQuantity.toFixed(2)}</Text>
        </View>
        <TouchableOpacity 
          style={[styles.stat, styles.statDanger]}
          onPress={handleClearAll}
          disabled={customMaterials.length === 0}
        >
          <Text style={styles.statLabelWhite}>🗑️ Limpiar</Text>
          <Text style={styles.statValueWhite}>Todo</Text>
        </TouchableOpacity>
      </View>

      {/* Real-time Input Form */}
      <View style={styles.formContainer}>
        <Text style={styles.formTitle}>Agregar Nuevo Material</Text>
        
        {/* Real-time typing indicator */}
        {isTyping && (
          <View style={styles.typingIndicator}>
            <Text style={styles.typingText}>⌨️ Capturando entrada...</Text>
          </View>
        )}

        <View style={styles.formField}>
          <Text style={styles.label}>Nombre del Material *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: Cajas de cartón, Etiquetas, etc."
            value={materialName}
            onChangeText={handleMaterialNameChange}
            autoCapitalize="words"
          />
          {materialName.length > 0 && (
            <Text style={styles.charCount}>
              {materialName.length} caracteres
            </Text>
          )}
        </View>

        <View style={styles.formRow}>
          <View style={[styles.formField, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.label}>Cantidad *</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              keyboardType="decimal-pad"
              value={quantity}
              onChangeText={setQuantity}
            />
          </View>

          <View style={[styles.formField, { flex: 1, marginLeft: 8 }]}>
            <Text style={styles.label}>Unidad</Text>
            <TextInput
              style={styles.input}
              placeholder="kg, cajas, pzas"
              value={unit}
              onChangeText={setUnit}
            />
          </View>
        </View>

        <View style={styles.formField}>
          <Text style={styles.label}>Notas (opcional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Información adicional..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={2}
          />
        </View>

        <TouchableOpacity 
          style={styles.addButton}
          onPress={handleAddMaterial}
        >
          <Text style={styles.addButtonText}>➕ Agregar Material</Text>
        </TouchableOpacity>
      </View>

      {/* Custom Materials List */}
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>
          {customMaterials.length === 0 
            ? 'Sin materiales - Comienza agregando uno' 
            : `${customMaterials.length} Material(es) en Inventario`}
        </Text>
      </View>

      <ScrollView 
        style={styles.listContainer}
        showsVerticalScrollIndicator={false}
      >
        {customMaterials.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>
              Tu inventario está vacío
            </Text>
            <Text style={styles.emptySubtext}>
              Agrega materiales usando el formulario arriba
            </Text>
          </View>
        ) : (
          customMaterials.map((material) => (
            <View key={material.id} style={styles.materialCard}>
              <View style={styles.materialHeader}>
                <Text style={styles.materialName}>{material.name}</Text>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleRemoveMaterial(material.id)}
                >
                  <Text style={styles.deleteButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.materialDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Cantidad:</Text>
                  <Text style={styles.detailValue}>
                    {material.quantity} {material.unit}
                  </Text>
                </View>

                {material.notes && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Notas:</Text>
                    <Text style={styles.detailValue}>{material.notes}</Text>
                  </View>
                )}

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Agregado:</Text>
                  <Text style={styles.detailValueSmall}>
                    {new Date(material.createdAt).toLocaleString('es-MX', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#2563EB',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    color: '#DBEAFE',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  stat: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statDanger: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  statLabelWhite: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2563EB',
    marginTop: 4,
  },
  statValueWhite: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 2,
  },
  formContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 12,
    marginVertical: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  formTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  typingIndicator: {
    backgroundColor: '#DBEAFE',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  typingText: {
    fontSize: 12,
    color: '#1E40AF',
    fontWeight: '500',
  },
  formField: {
    marginBottom: 12,
  },
  formRow: {
    flexDirection: 'row',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    height: 60,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
  },
  addButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  listHeader: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  materialCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  materialHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  materialName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    flex: 1,
  },
  deleteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: 'bold',
  },
  materialDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '600',
  },
  detailValueSmall: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});

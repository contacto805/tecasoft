import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, 
  ActivityIndicator, TextInput, Modal, Image 
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://i2p1r4rtv03bja5uu39r6.web-preview.appgen.com';

export default function GastosMobile() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraRef, setCameraRef] = useState(null);
  const [photoUri, setPhotoUri] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  
  const [formData, setFormData] = useState({
    productName: '',
    costPerUnit: '',
    quantity: '',
    total: '',
    department: 'Empaque',
    concept: '',
    notes: '',
    expenseDate: new Date().toISOString().split('T')[0]
  });

  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    loadData();
    loadConfig();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/mobile/expenses`);
      if (res.data.status === 'success') {
        setExpenses(res.data.data || []);
      } else {
        setExpenses(res.data || []);
      }
    } catch (e) {
      console.error('Load expenses error', e);
      Alert.alert('Error', 'No se pudieron cargar los gastos. Verifica conexión.');
    } finally {
      setLoading(false);
    }
  };

  const loadConfig = async () => {
    try {
      const [areas, concs] = await Promise.all([
        axios.get(`${API_URL}/api/expense-areas`),
        axios.get(`${API_URL}/api/expense-concepts`)
      ]);
      setDepartments(Array.isArray(areas.data) ? areas.data : []);
      setConcepts(Array.isArray(concs.data) ? concs.data : []);
    } catch (e) { 
      console.log('Config load skipped or error');
    }
  };

  const syncExpenses = async () => {
    try {
      Alert.alert('Sincronizando...', 'Obteniendo registros desde el sistema.');
      await loadData();
      Alert.alert('Sincronizado', 'Datos actualizados desde el sistema.');
    } catch (e) {
      Alert.alert('Error de sync', 'No se pudo sincronizar.');
    }
  };

  const handleFormChange = (name, value) => {
    let newForm = { ...formData, [name]: value };
    if (name === 'costPerUnit' || name === 'quantity') {
      const c = parseFloat(newForm.costPerUnit) || 0;
      const q = parseFloat(newForm.quantity) || 0;
      newForm.total = (c * q).toFixed(2);
    }
    setFormData(newForm);
  };

  const openCamera = async () => {
    if (!permission?.granted) {
      const p = await requestPermission();
      if (!p.granted) {
        Alert.alert('Permiso requerido', 'Necesitas permitir acceso a cámara.');
        return;
      }
    }
    setPhotoUri(null);
    setShowCamera(true);
  };

  const takePhoto = async () => {
    if (!cameraRef) return;
    
    try {
      const photo = await cameraRef.takePictureAsync({ quality: 0.7, base64: false });
      setUploadingPhoto(true);
      setShowCamera(false);

      // Upload photo
      const form = new FormData();
      form.append('file', {
        uri: photo.uri,
        name: 'gasto-photo.jpg',
        type: 'image/jpeg'
      });

      const uploadRes = await fetch(`${API_URL}/api/upload`, { method: 'POST', body: form });
      const uploadData = await uploadRes.json();

      if (uploadData.url) {
        setPhotoUri(uploadData.url);
        Alert.alert('Foto guardada', 'Comprobante subido correctamente.');
      } else {
        Alert.alert('Error foto', 'No pudieron subir la foto. Intenta otra vez.');
      }
    } catch (err) {
      console.error('Camera/upload:', err);
      Alert.alert('Error', 'Fallo la cámara o carga de imagen.');
      setShowCamera(false);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const cancelCamera = () => {
    setShowCamera(false);
  };

  const saveExpense = async () => {
    const f = formData;
    if (!f.productName || !f.costPerUnit || !f.quantity || !f.department) {
      Alert.alert('Faltan datos', 'Completa producto, costo, cantidad y departamento.');
      return;
    }

    try {
      const payload = {
        productName: f.productName,
        costPerUnit: parseFloat(f.costPerUnit),
        quantity: parseFloat(f.quantity),
        total: parseFloat(f.total || '0'),
        department: f.department,
        concept: f.concept || '',
        notes: f.notes || '',
        expenseDate: f.expenseDate,
        photoUrl: photoUri || null
      };

      const res = await axios.post(`${API_URL}/api/mobile/expenses`, payload);

      if (res.data.status === 'success' || res.status === 201) {
        setShowForm(false);
        resetForm();
        await loadData();
        Alert.alert('Guardado', 'Gasto registrado y sincronizado con el sistema.');
      } else {
        Alert.alert('Error', res.data.message || 'No se guardó el gasto.');
      }
    } catch (err) {
      console.error('Save gasto:', err);
      Alert.alert('Error', 'Error guardando gasto. Verifica la conexión con el sistema.');
    }
  };

  const resetForm = () => {
    setFormData({
      productName: '',
      costPerUnit: '',
      quantity: '',
      total: '',
      department: departments?.[0]?.area_name || 'Empaque',
      concept: '',
      notes: '',
      expenseDate: new Date().toISOString().split('T')[0]
    });
    setPhotoUri(null);
  };

  const openAdd = () => {
    resetForm();
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    resetForm();
  };

  const totalGastos = expenses.reduce((sum, e) => sum + parseFloat(e.total || 0), 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>💰 Módulo Gastos</Text>
        <Text style={styles.subtitle}>Enlace automático al sistema</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Total Gastos</Text>
          <Text style={styles.statValue}>${totalGastos.toFixed(2)}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Registros</Text>
          <Text style={styles.statValue}>{expenses.length}</Text>
        </View>
        <TouchableOpacity style={styles.syncBtn} onPress={syncExpenses}>
          <Text style={styles.syncText}>🔄 SYNC</Text>
        </TouchableOpacity>
      </View>

      {/* Expense List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0f766e" />
          <Text style={{ marginTop: 10, color: '#666' }}>Cargando gastos...</Text>
        </View>
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {expenses.length > 0 ? expenses.map((exp, idx) => (
            <View key={exp.id || idx} style={styles.card}>
              <Text style={styles.cardTitle}>{exp.product_name || 'Gasto'}</Text>
              <View style={styles.cardRow}>
                <Text style={styles.cardMuted}>Fecha: {exp.expense_date ? new Date(exp.expense_date).toLocaleDateString('es-MX') : '—'}</Text>
                <Text style={styles.cardTotal}>${parseFloat(exp.total || 0).toFixed(2)}</Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardDept}>{exp.department}</Text>
                {exp.concept ? <Text style={styles.cardConcept}>{exp.concept}</Text> : null}
              </View>
              {exp.photo_url && <Text style={styles.hasPhoto}>📷 Tiene comprobante</Text>}
              {exp.notes && <Text style={styles.notes} numberOfLines={2}>📝 {exp.notes}</Text>}
            </View>
          )) : (
            <View style={styles.center}>
              <Text style={styles.empty}>Sin gastos registrados. Presiona + para crear uno nuevo.</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* FAB Add */}
      <TouchableOpacity style={styles.fab} onPress={openAdd}>
        <Text style={styles.fabText}>＋</Text>
      </TouchableOpacity>

      {/* Add / Form Modal */}
      <Modal visible={showForm} animationType="slide" transparent>
        <View style={styles.modalWrap}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nuevo Gasto</Text>

            <TextInput style={styles.input} placeholder="Producto / Descripción" value={formData.productName} onChangeText={(v)=>handleFormChange('productName', v)} />

            <View style={styles.rowInputs}>
              <TextInput style={[styles.input, { flex:1, marginRight: 8 }]} placeholder="Costo unit." keyboardType="decimal-pad" value={formData.costPerUnit} onChangeText={(v)=>handleFormChange('costPerUnit', v)} />
              <TextInput style={[styles.input, { flex:1 }]} placeholder="Cantidad" keyboardType="decimal-pad" value={formData.quantity} onChangeText={(v)=>handleFormChange('quantity', v)} />
            </View>

            <TextInput style={[styles.input, { backgroundColor: '#f3f4f6' }]} placeholder="Total" value={formData.total} editable={false} />

            {/* Department select */}
            <Text style={styles.label}>Departamento</Text>
            <ScrollView horizontal style={{ marginBottom: 8 }} showsHorizontalScrollIndicator={false}>
              {(departments.length ? departments : [{area_name:'Empaque'},{area_name:'Producción'},{area_name:'Transporte'},{area_name:'Administración'}]).map(d => (
                <TouchableOpacity key={d.id || d.area_name} style={[styles.pill, formData.department === d.area_name && styles.pillActive]} 
                  onPress={() => handleFormChange('department', d.area_name)}>
                  <Text style={[styles.pillTxt, formData.department === d.area_name && styles.pillActiveTxt]}>{d.area_name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Concepts */}
            {concepts.length > 0 && (
              <>
                <Text style={styles.label}>Concepto</Text>
                <ScrollView horizontal style={{ marginBottom: 8 }} showsHorizontalScrollIndicator={false}>
                  {concepts.map(c => (
                    <TouchableOpacity key={c.id || c.concept_name} style={[styles.pill, formData.concept === c.concept_name && styles.pillActive]} onPress={() => handleFormChange('concept', c.concept_name)}>
                      <Text style={[styles.pillTxt, formData.concept === c.concept_name && styles.pillActiveTxt]}>{c.concept_name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            <TextInput style={styles.input} placeholder="Notas adicionales" value={formData.notes} onChangeText={(v)=>handleFormChange('notes', v)} />

            <TouchableOpacity style={styles.dateWrap} onPress={()=>{ /* Optional: more calendar later */ }}>
              <Text>📅 Fecha: {formData.expenseDate}</Text>
            </TouchableOpacity>

            {/* Photo Section */}
            <View style={{ marginTop: 8 }}>
              <Text style={styles.label}>Comprobante (foto)</Text>
              {photoUri ? (
                <View>
                  <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                  <TouchableOpacity onPress={()=>{ setPhotoUri(null); }}><Text style={{ color: '#dc2626', marginTop:4 }}>Eliminar foto</Text></TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.camBtn} onPress={openCamera} disabled={uploadingPhoto}>
                  <Text style={styles.camBtnText}>{uploadingPhoto ? '⏳ Subiendo foto...' : '📷 Tomar Foto del Comprobante'}</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.formBtns}>
              <TouchableOpacity style={[styles.btn, { backgroundColor: '#64748b' }]} onPress={cancelForm}>
                <Text style={styles.btnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: '#0f766e' }]} onPress={saveExpense}>
                <Text style={styles.btnText}>Guardar Gasto</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Camera Modal */}
      <Modal visible={showCamera} animationType="slide">
        <View style={styles.cameraContainer}>
          <CameraView style={styles.camera} ref={setCameraRef} facing="back" />
          <View style={styles.camControls}>
            <TouchableOpacity style={[styles.camBtn, styles.camCancel]} onPress={cancelCamera}>
              <Text style={styles.btnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.camBtn, styles.camTake]} onPress={takePhoto}>
              <Text style={styles.btnText}>📸 Capturar</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.camHint}>Apunta al comprobante y captura la foto</Text>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { backgroundColor: '#0f766e', paddingTop: 58, paddingBottom: 18, paddingHorizontal: 18 },
  title: { color: 'white', fontSize: 26, fontWeight: 'bold' },
  subtitle: { color: '#a1e3e0', fontSize: 13, marginTop: 3 },
  statsRow: { flexDirection: 'row', padding: 14, gap: 10 },
  statBox: { flex: 1, backgroundColor: 'white', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  statLabel: { fontSize: 12, color: '#475569' },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#0f766e', marginTop: 2 },
  syncBtn: { backgroundColor: '#0f766e', borderRadius: 12, paddingHorizontal: 18, justifyContent: 'center' },
  syncText: { color: 'white', fontWeight: '600', fontSize: 13 },
  list: { flex: 1, paddingHorizontal: 14 },
  card: { backgroundColor: 'white', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  cardTitle: { fontWeight: '700', fontSize: 16, color: '#0f172a' },
  cardRow: { flexDirection: 'row', marginTop: 6, justifyContent: 'space-between' },
  cardMuted: { color: '#64748b', fontSize: 12 },
  cardTotal: { fontWeight: '800', fontSize: 16, color: '#0f766e' },
  cardDept: { backgroundColor: '#e0f2fe', color: '#0369a1', paddingHorizontal: 9, paddingVertical: 2, borderRadius: 999, fontSize: 11 },
  cardConcept: { color: '#475569', fontSize: 13, marginLeft: 8 },
  hasPhoto: { color: '#059669', fontSize: 12, marginTop: 6 },
  notes: { color: '#475569', marginTop: 4 },
  empty: { color: '#64748b', fontSize: 15, padding: 22, textAlign: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  fab: { position: 'absolute', bottom: 28, right: 26, width: 58, height: 58, borderRadius: 29, backgroundColor: '#0f766e', alignItems: 'center', justifyContent: 'center', elevation: 9 },
  fabText: { color: '#fff', fontSize: 34, marginTop: -2, fontWeight: '300' },
  modalWrap: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', padding: 20, paddingBottom: 38, borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginBottom: 14 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 11, padding: 13, marginBottom: 10, fontSize: 16, color: '#0f172a' },
  rowInputs: { flexDirection: 'row' },
  label: { fontSize: 12, fontWeight: '600', color: '#334155', marginBottom: 6, marginLeft: 2 },
  pill: { paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#f1f5f9', borderRadius: 999, marginRight: 8 },
  pillActive: { backgroundColor: '#0f766e' },
  pillTxt: { color: '#334155', fontSize: 13 },
  pillActiveTxt: { color: '#fff' },
  formBtns: { flexDirection: 'row', gap: 12, marginTop: 18 },
  btn: { flex: 1, padding: 15, alignItems: 'center', borderRadius: 12 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  camBtn: { paddingVertical: 15, backgroundColor: '#0ea5e9', borderRadius: 12, alignItems: 'center', marginTop: 2 },
  camBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  camControls: { position: 'absolute', bottom: 50, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 30 },
  camCancel: { backgroundColor: '#475569', paddingVertical: 16, paddingHorizontal: 32, borderRadius: 999 },
  camTake: { backgroundColor: '#059669', paddingVertical: 16, paddingHorizontal: 40, borderRadius: 999 },
  camHint: { position: 'absolute', bottom: 16, width: '100%', textAlign: 'center', color: '#cbd5e1', fontSize: 12 },
  photoPreview: { width: '100%', height: 160, borderRadius: 10, backgroundColor: '#f1f5f9' },
  dateWrap: { padding: 10, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, alignItems: 'center' },
});
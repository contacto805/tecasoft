import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, 
  ActivityIndicator, TextInput, Modal, Image 
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://i2p1r4rtv03bja5uu39r6.web-preview.appgen.com';

export default function CuttingOrdersMobile() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [showForm, setShowForm] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraRef, setCameraRef] = useState(null);
  const [photoUri, setPhotoUri] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [formData, setFormData] = useState({
    producer_name: '',
    orchard_name: '',
    boxes_count: '',
    crew_chief_name: '',
    driver_name: '',
    meeting_point: '',
    truck_plates: '',
    location: '',
    scale: '',
    crew_workers_count: '',
    notes: '',
    cutting_date: new Date().toISOString().split('T')[0]
  });

  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/mobile/cutting-orders`);
      if (res.data.status === 'success') {
        setOrders(res.data.data || []);
      } else {
        const direct = await axios.get(`${API_URL}/api/cutting-orders`);
        setOrders(Array.isArray(direct.data) ? direct.data : []);
      }
    } catch (e) {
      console.error('Load orders err', e);
      try {
        const direct = await axios.get(`${API_URL}/api/cutting-orders`);
        setOrders(Array.isArray(direct.data) ? direct.data : []);
      } catch (e2) {
        Alert.alert('Error', 'No se pudieron cargar las órdenes. Verifica la conexión.');
      }
    } finally {
      setLoading(false);
    }
  };

  const syncOrders = async () => {
    Alert.alert('Sincronizando', 'Cargando órdenes actuales...');
    await loadOrders();
    Alert.alert('Sincronizado', 'Datos actualizados del sistema.');
  };

  const handleFormChange = (name, value) => {
    setFormData({ ...formData, [name]: value });
  };

  const openCamera = async () => {
    if (!permission?.granted) {
      const p = await requestPermission();
      if (!p.granted) {
        Alert.alert('Permiso', 'Se necesita cámara para fotos de evidencia.');
        return;
      }
    }
    setPhotoUri(null);
    setShowCamera(true);
  };

  const takePhoto = async () => {
    if (!cameraRef) return;
    try {
      const photo = await cameraRef.takePictureAsync({ quality: 0.7 });
      setUploadingPhoto(true);
      setShowCamera(false);

      const form = new FormData();
      form.append('file', {
        uri: photo.uri,
        name: 'orden-corte.jpg',
        type: 'image/jpeg'
      });

      const up = await fetch(`${API_URL}/api/upload`, { method: 'POST', body: form });
      const ud = await up.json();

      if (ud.url) {
        setPhotoUri(ud.url);
        Alert.alert('Foto', 'Evidencia subida.');
      } else {
        Alert.alert('Error', 'No se subió la foto.');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Fallo', 'Error de cámara.');
      setShowCamera(false);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const saveOrder = async () => {
    const f = formData;
    if (!f.producer_name || !f.boxes_count) {
      Alert.alert('Datos', 'Productor y cajas requeridos.');
      return;
    }

    try {
      const payload = {
        ...f,
        boxes_count: parseInt(f.boxes_count, 10) || 0,
        crew_workers_count: parseInt(f.crew_workers_count, 10) || 0,
        photo_url: photoUri
      };

      const res = await axios.post(`${API_URL}/api/mobile/cutting-orders`, payload);

      if (res.data.status === 'success') {
        setShowForm(false);
        resetForm();
        await loadOrders();
        Alert.alert('Listo', 'Orden creada y enviada al sistema.');
      } else {
        Alert.alert('Error', res.data.message || 'No se guardó.');
      }
    } catch (err) {
      console.error('Save order:', err);
      // Fallback to direct API
      try {
        await axios.post(`${API_URL}/api/cutting-orders`, {
          producer_name: f.producer_name,
          orchard_name: f.orchard_name,
          cutting_date: f.cutting_date,
          location: f.location,
          boxes_count: parseInt(f.boxes_count),
          crew_chief_name: f.crew_chief_name,
          driver_name: f.driver_name,
          meeting_point: f.meeting_point,
          truck_plates: f.truck_plates
        });
        await loadOrders();
        setShowForm(false);
        resetForm();
        Alert.alert('Listo', 'Orden creada.');
      } catch (e2) {
        Alert.alert('Error', 'No se guardó la orden.');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      producer_name: '',
      orchard_name: '',
      boxes_count: '',
      crew_chief_name: '',
      driver_name: '',
      meeting_point: '',
      truck_plates: '',
      location: '',
      scale: '',
      crew_workers_count: '',
      notes: '',
      cutting_date: new Date().toISOString().split('T')[0]
    });
    setPhotoUri(null);
  };

  const openAdd = () => {
    resetForm();
    setShowForm(true);
  };

  const pending = orders.filter(o => o.status === 'pending' || !o.status);
  const progress = orders.filter(o => o.status === 'in_progress');
  const done = orders.filter(o => o.status === 'completed');

  const display = activeTab === 'pending' ? pending : activeTab === 'in_progress' ? progress : done;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🔪 Órdenes de Corte</Text>
        <Text style={styles.subtitle}>Sincronización automática al sistema</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLab}>Pendientes</Text>
          <Text style={styles.statVal}>{pending.length}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLab}>En Progreso</Text>
          <Text style={styles.statVal}>{progress.length}</Text>
        </View>
        <TouchableOpacity style={styles.syncBtn} onPress={syncOrders}>
          <Text style={styles.syncT}>🔄 SYNC</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        {['pending', 'in_progress', 'completed'].map(t => (
          <TouchableOpacity key={t} onPress={() => setActiveTab(t)} style={[styles.tab, activeTab === t && styles.tabA]}>
            <Text style={[styles.tabTxt, activeTab === t && styles.tabTxtA]}>
              {t === 'pending' ? 'Pendientes' : t === 'in_progress' ? 'En Progreso' : 'Completadas'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#0f766e" /></View>
      ) : (
        <ScrollView style={styles.list}>
          {display.length > 0 ? display.map((order, i) => (
            <View key={order.id || i} style={styles.card}>
              <Text style={styles.cardTitle}>{order.folio || 'Orden #' + order.id}</Text>
              <View style={styles.row}><Text style={styles.l}>Productor:</Text><Text style={styles.v}>{order.producer_name || '-'}</Text></View>
              <View style={styles.row}><Text style={styles.l}>Cajas:</Text><Text style={styles.v}>{order.boxes_count || 0}</Text></View>
              <View style={styles.row}><Text style={styles.l}>Jefe/Chofer:</Text><Text style={styles.v}>{order.crew_chief_name || order.driver_name || '-'}</Text></View>
              {order.notes && <Text style={styles.notes}>📝 {order.notes}</Text>}
              {order.photo_url && <Text style={styles.photoTag}>📷 Evidencia</Text>}
              <Text style={styles.date}>{order.cutting_date || ''}</Text>
            </View>
          )) : <Text style={styles.empty}>No hay órdenes en esta sección.</Text>}
        </ScrollView>
      )}

      <TouchableOpacity style={styles.fab} onPress={openAdd}>
        <Text style={styles.fabTx}>＋</Text>
      </TouchableOpacity>

      {/* Add Modal */}
      <Modal visible={showForm} animationType="slide" transparent>
        <View style={styles.modalWrap}>
          <View style={styles.modalCt}>
            <Text style={styles.mTitle}>Nueva Orden de Corte</Text>

            <TextInput style={styles.ipt} placeholder="Productor *" value={formData.producer_name} onChangeText={v => handleFormChange('producer_name', v)} />
            <TextInput style={styles.ipt} placeholder="Nombre de huerto/orchard" value={formData.orchard_name} onChangeText={v => handleFormChange('orchard_name', v)} />

            <View style={styles.rowIn}>
              <TextInput style={[styles.ipt, {flex:1, marginRight:6}]} placeholder="Cajas *" keyboardType="numeric" value={formData.boxes_count} onChangeText={v => handleFormChange('boxes_count', v)} />
              <TextInput style={[styles.ipt, {flex:1}]} placeholder="# Cuadrilla" keyboardType="numeric" value={formData.crew_workers_count} onChangeText={v => handleFormChange('crew_workers_count', v)} />
            </View>

            <TextInput style={styles.ipt} placeholder="Jefe de Cuadrilla" value={formData.crew_chief_name} onChangeText={v => handleFormChange('crew_chief_name', v)} />
            <TextInput style={styles.ipt} placeholder="Chofer" value={formData.driver_name} onChangeText={v => handleFormChange('driver_name', v)} />
            <TextInput style={styles.ipt} placeholder="Placas del camión" value={formData.truck_plates} onChangeText={v => handleFormChange('truck_plates', v)} />
            <TextInput style={styles.ipt} placeholder="Punto de encuentro" value={formData.meeting_point} onChangeText={v => handleFormChange('meeting_point', v)} />
            <TextInput style={styles.ipt} placeholder="Ubicación / Campo" value={formData.location} onChangeText={v => handleFormChange('location', v)} />
            <TextInput style={styles.ipt} placeholder="Notas o acuerdo especial" value={formData.notes} onChangeText={v => handleFormChange('notes', v)} />

            <TouchableOpacity style={{marginBottom: 6}} onPress={() => handleFormChange('cutting_date', new Date().toISOString().split('T')[0])}>
              <Text>📅 Fecha: {formData.cutting_date}</Text>
            </TouchableOpacity>

            <Text style={styles.labl}>Evidencia (foto)</Text>
            {photoUri ? (
              <View>
                <Image source={{uri: photoUri}} style={{height: 110, borderRadius: 8}} />
                <TouchableOpacity onPress={() => setPhotoUri(null)}><Text style={{color:'#c00', marginTop:4}}>Quitar</Text></TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.camB} onPress={openCamera} disabled={uploadingPhoto}>
                <Text style={styles.camTx}>{uploadingPhoto ? 'Subiendo...' : '📸 Tomar foto evidencia'}</Text>
              </TouchableOpacity>
            )}

            <View style={styles.fBtns}>
              <TouchableOpacity style={[styles.btn, {backgroundColor:'#64748b'}]} onPress={() => { setShowForm(false); resetForm(); }}>
                <Text style={styles.btnTx}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, {backgroundColor:'#0f766e'}]} onPress={saveOrder}>
                <Text style={styles.btnTx}>Crear Orden</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Camera */}
      <Modal visible={showCamera} animationType="slide">
        <View style={styles.camFull}>
          <CameraView style={styles.camView} ref={setCameraRef} facing="back" />
          <View style={styles.camCtr}>
            <TouchableOpacity style={[styles.camB, {backgroundColor:'#475569'}]} onPress={() => setShowCamera(false)}>
              <Text style={styles.btnTx}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.camB, {backgroundColor:'#166534'}]} onPress={takePhoto}>
              <Text style={styles.btnTx}>📸 Capturar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { backgroundColor: '#0f766e', paddingTop: 60, paddingBottom: 16, paddingHorizontal: 18 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  subtitle: { color: '#a5f3fc', fontSize: 13, marginTop: 3 },
  statsRow: { flexDirection: 'row', padding: 12, gap: 8, alignItems: 'center' },
  stat: { backgroundColor: '#fff', flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  statLab: { fontSize: 12, color: '#475569' },
  statVal: { fontSize: 22, fontWeight: '700', color: '#0f766e' },
  syncBtn: { backgroundColor: '#0f766e', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 20 },
  syncT: { color: '#fff', fontWeight: '700' },
  tabs: { paddingHorizontal: 12, flexDirection: 'row', gap: 6, paddingBottom: 8 },
  tab: { paddingVertical: 8, flex: 1, backgroundColor: '#e2e8f0', borderRadius: 999, alignItems: 'center' },
  tabA: { backgroundColor: '#0f766e' },
  tabTxt: { fontSize: 12, fontWeight: '600', color: '#475569' },
  tabTxtA: { color: '#fff' },
  list: { flex: 1, paddingHorizontal: 14 },
  card: { backgroundColor: '#fff', padding: 15, borderRadius: 14, marginVertical: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a', marginBottom: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  l: { color: '#64748b', fontSize: 13 },
  v: { fontSize: 14, fontWeight: '600', color: '#111827' },
  notes: { fontSize: 13, marginTop: 8, color: '#475569' },
  date: { marginTop: 8, fontSize: 11, color: '#94a3b8' },
  photoTag: { fontSize: 12, color: '#166534', marginTop: 4 },
  empty: { padding: 40, color: '#64748b', textAlign: 'center', fontSize: 15 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  fab: { position: 'absolute', bottom: 26, right: 24, width: 58, height: 58, backgroundColor: '#0f766e', borderRadius: 29, alignItems: 'center', justifyContent: 'center', elevation: 8 },
  fabTx: { fontSize: 34, color: '#fff', marginTop: -2 },
  modalWrap: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalCt: { backgroundColor: '#fff', padding: 18, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 40 },
  mTitle: { fontSize: 20, fontWeight: '700', marginBottom: 14 },
  ipt: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 13, marginBottom: 9, fontSize: 16 },
  rowIn: { flexDirection: 'row' },
  labl: { fontWeight: '600', color: '#334155', fontSize: 12, marginBottom: 4 },
  camB: { backgroundColor: '#0ea5e9', paddingVertical: 14, borderRadius: 11, alignItems: 'center' },
  camTx: { color: '#fff', fontWeight: '700', fontSize: 15 },
  fBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 11, alignItems: 'center' },
  btnTx: { color: '#fff', fontSize: 15, fontWeight: '700' },
  camFull: { flex: 1, backgroundColor: '#000' },
  camView: { flex: 1 },
  camCtr: { flexDirection: 'row', justifyContent: 'space-around', padding: 32, position: 'absolute', bottom: 44, left: 0, right: 0 },
});

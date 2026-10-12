import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, 
  ActivityIndicator, TextInput, Modal, Image 
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://i2p1r4rtv03bja5uu39r6.web-preview.appgen.com';

export default function FruitIntakeMobile() {
  const [lots, setLots] = useState([]);
  const [weighings, setWeighings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraRef, setCameraRef] = useState(null);
  const [photoUri, setPhotoUri] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [formData, setFormData] = useState({
    lot_number: '',
    producer: '',
    orchard_name: '',
    weight_kg: '',
    boxes: '',
    notes: ''
  });

  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    loadFruitData();
  }, []);

  const loadFruitData = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/mobile/fruit-input`);
      if (res.data.status === 'success' && res.data.data) {
        const d = res.data.data;
        setLots(d.lots || []);
        setWeighings(d.weighings || []);
      } else {
        // fallback: use main routes
        const [lres, wres] = await Promise.all([
          axios.get(`${API_URL}/api/lots`),
          axios.get(`${API_URL}/api/fruit-intake`)
        ]);
        setLots(Array.isArray(lres.data) ? lres.data : []);
        setWeighings(Array.isArray(wres.data) ? wres.data : []);
      }
    } catch (e) {
      console.error('Load fruit err', e);
      try {
        const lres = await axios.get(`${API_URL}/api/lots`);
        setLots(Array.isArray(lres.data) ? lres.data : []);
      } catch {}
    } finally {
      setLoading(false);
    }
  };

  const syncData = async () => {
    Alert.alert('Sincronizando...', 'Actualizando datos del sistema');
    await loadFruitData();
    Alert.alert('Actualizado', 'Sincronizado con el módulo de Ingreso de Fruta');
  };

  const handleChange = (k, v) => setFormData({ ...formData, [k]: v });

  const openCamera = async () => {
    if (!permission?.granted) {
      const p = await requestPermission();
      if (!p.granted) { Alert.alert('Permiso','Necesitas la cámara'); return; }
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

      const fd = new FormData();
      fd.append('file', { uri: photo.uri, name: 'pesaje-foto.jpg', type: 'image/jpeg' });

      const ures = await fetch(`${API_URL}/api/upload`, { method: 'POST', body: fd });
      const udata = await ures.json();
      if (udata.url) {
        setPhotoUri(udata.url);
        Alert.alert('Foto', 'Comprobante subido.');
      }
    } catch (err) {
      Alert.alert('Error','Fallo al subir foto.');
      setShowCamera(false);
    } finally { setUploadingPhoto(false); }
  };

  const saveWeighing = async () => {
    const f = formData;
    if (!f.weight_kg) {
      Alert.alert('Datos', 'Ingresa el peso (kg).');
      return;
    }

    try {
      //Attempt using direct fruit input or mobile api
      const payload = {
        actionType: 'createWeighing',
        lot_id: f.lot_number ? parseInt(f.lot_number) : null, // if we use id or use lot num later
        boxes: parseInt(f.boxes) || 0,
        gross_weight: parseFloat(f.weight_kg) + 2,
        with_pallet: true,
        net_weight: parseFloat(f.weight_kg),
        photo_url: photoUri,
      };

      if (!payload.lot_id) {
        // Create lot + then weighing
        const lotPayload = {
          actionType: 'createLot',
          lot_number: `INT-${Date.now().toString().slice(-7)}`,
          producer: f.producer || 'Campo',
          orchard_name: f.orchard_name,
          fruit_type: 'aguacate',
          date: new Date().toISOString().split('T')[0],
          fruit_price: 0,
          collector_name: 'App Móvil',
          commission_amount: 0
        };
        const lres = await axios.post(`${API_URL}/api/mobile/fruit-input`, lotPayload);
        if (lres.data?.data?.id) payload.lot_id = lres.data.data.id;
      }

      await axios.post(`${API_URL}/api/mobile/fruit-input`, payload);

      setShowForm(false);
      resetForm();
      await loadFruitData();
      Alert.alert('Registrado', 'Pesaje / Ingreso registrado en sistema.');
    } catch (err) {
      console.error(err);
      // Fallback direct to fruit-intake old 
      try {
        await axios.post(`${API_URL}/api/fruit-intake`, {
          lot_id: parseInt(f.lot_number) || 1,
          weight_kg: parseFloat(f.weight_kg),
          timestamp: new Date().toISOString()
        });
        await loadFruitData();
        setShowForm(false);
        resetForm();
        Alert.alert('Guardado', 'Ingreso publicado.');
      } catch(e2) {
        Alert.alert('Error', 'No se pudo guardar el ingreso. Revisa conexión.');
      }
    }
  };

  const resetForm = () => {
    setFormData({ lot_number: '', producer:'', orchard_name:'', weight_kg:'', boxes:'', notes:'' });
    setPhotoUri(null);
  };

  const totalKg = weighings.reduce((s, w) => s + (parseFloat(w.net_weight || w.weight_kg) || 0), 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🍑 Ingreso de Fruta</Text>
        <Text style={styles.subtitle}>Sincronización en tiempo real al sistema</Text>
      </View>

      <View style={styles.stats}>
        <View style={styles.statBox}><Text style={styles.sLab}>Lotes</Text><Text style={styles.sVal}>{lots.length}</Text></View>
        <View style={styles.statBox}><Text style={styles.sLab}>Kg Total</Text><Text style={styles.sVal}>{totalKg.toFixed(1)}</Text></View>
        <TouchableOpacity style={styles.syncB} onPress={syncData}><Text style={styles.syncTx}>SYNC</Text></TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#166534" /></View>
      ) : (
        <ScrollView style={styles.scroll}>
          {lots.length > 0 && <Text style={styles.sec}>Lotes recientes</Text>}
          {lots.slice(0,6).map((l,i)=> (
            <View key={i} style={styles.card}>
              <Text style={styles.cardH}>{l.lot_number || 'Lote'} • {l.producer || ''}</Text>
              <Text style={styles.muted}>Huerto: {l.orchard_name || '-'}   |   {l.total_kg || '—'} kg</Text>
            </View>
          ))}

          <Text style={styles.sec}>Últimos pesajes</Text>
          {weighings.length > 0 ? weighings.slice(0,10).map((w, idx)=>(
            <View key={idx} style={styles.card}>
              <Text style={styles.cardH}>Pesaje • {parseFloat(w.net_weight || w.weight_kg).toFixed(0)} kg</Text>
              <Text style={styles.muted}>Lote: {w.lot_id || w.lot_number}  {w.photo_url ? '📷' : ''}</Text>
            </View>
          )) : <Text style={{padding:18,color:'#64748b'}}>No hay pesajes registrados aún. Crea uno nuevo.</Text>}
        </ScrollView>
      )}

      <TouchableOpacity style={styles.fab} onPress={() => {resetForm(); setShowForm(true);}}>
        <Text style={styles.fabT}>＋</Text>
      </TouchableOpacity>

      {/* Form */}
      <Modal visible={showForm} animationType="slide" transparent>
        <View style={styles.mWrap}>
          <View style={styles.mContent}>
            <Text style={styles.mT}>Nuevo Ingreso de Fruta</Text>

            <TextInput style={styles.inp} placeholder="Lote ID (o deja en blanco para nuevo)" value={formData.lot_number} onChangeText={v=>handleChange('lot_number',v)} keyboardType="numeric" />
            <TextInput style={styles.inp} placeholder="Productor" value={formData.producer} onChangeText={v=>handleChange('producer',v)} />
            <TextInput style={styles.inp} placeholder="Huerto" value={formData.orchard_name} onChangeText={v=>handleChange('orchard_name',v)} />

            <View style={{flexDirection:'row'}}>
              <TextInput style={[styles.inp, { flex: 1, marginRight: 8 }]} placeholder="Peso neto KG *" keyboardType="decimal-pad" value={formData.weight_kg} onChangeText={v=>handleChange('weight_kg', v)} />
              <TextInput style={[styles.inp, { flex: 1 }]} placeholder="Cajas" keyboardType="numeric" value={formData.boxes} onChangeText={v=>handleChange('boxes',v)} />
            </View>

            <TextInput style={styles.inp} placeholder="Notas" value={formData.notes} onChangeText={v=>handleChange('notes',v)} />

            <Text style={{marginVertical:4, fontWeight:'600', color:'#334155'}}>Foto del pesaje (opcional)</Text>
            {photoUri ? (
              <Image source={{uri:photoUri}} style={{height:120, borderRadius:8, marginBottom:10}} />
            ) : (
              <TouchableOpacity style={styles.camBtn} onPress={openCamera}><Text style={styles.camTx}>📷 Tomar Foto</Text></TouchableOpacity>
            )}

            <View style={{flexDirection:'row', gap:10, marginTop:14}}>
              <TouchableOpacity onPress={()=>{setShowForm(false);resetForm();}} style={[styles.btn, {backgroundColor:'#64748b'}]}><Text style={styles.btnTx}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity onPress={saveWeighing} style={[styles.btn, {backgroundColor:'#166534'}]}><Text style={styles.btnTx}>Registrar Pesaje</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cam */}
      <Modal visible={showCamera}>
        <View style={{flex:1}}>
          <CameraView style={{flex:1}} ref={setCameraRef} facing="back" />
          <View style={{position:'absolute', bottom:50, width:'100%', flexDirection:'row', justifyContent:'space-around'}}>
            <TouchableOpacity onPress={()=>setShowCamera(false)} style={[styles.camBtn,{backgroundColor:'#475569'}]}><Text style={{color:'#fff'}}>Cerrar</Text></TouchableOpacity>
            <TouchableOpacity onPress={takePhoto} style={[styles.camBtn,{backgroundColor:'#052e16'}]}><Text style={{color:'#fff', fontWeight:'700'}}>📸 Capturar</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { backgroundColor: '#166534', paddingTop: 58, paddingBottom: 14, paddingHorizontal: 18 },
  title: { color: 'white', fontSize: 24, fontWeight: 'bold' },
  subtitle: { color: '#86efac', fontSize: 12, marginTop: 2 },
  stats: { flexDirection: 'row', padding: 12, gap: 9 },
  statBox: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 13, borderWidth: 1, borderColor: '#e2e8f0' },
  sLab: { fontSize: 11, color: '#64748b' },
  sVal: { fontSize: 21, fontWeight: '700', marginTop: 2, color: '#166534' },
  syncB: { backgroundColor: '#166534', paddingHorizontal: 18, borderRadius: 11, justifyContent: 'center' },
  syncTx: { color: '#fff', fontWeight: '700' },
  scroll: { flex: 1, paddingHorizontal: 14 },
  sec: { marginLeft: 4, fontWeight: '700', marginTop: 12, color: '#334155' },
  card: { backgroundColor: '#fff', marginBottom: 8, borderRadius: 11, padding: 13, borderWidth: 1, borderColor: '#e2e8f0' },
  cardH: { fontWeight: '700', marginBottom: 4 },
  muted: { color: '#64748b', fontSize: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  fab: { position: 'absolute', bottom: 28, right: 22, backgroundColor: '#166534', width: 57, height: 57, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  fabT: { color: '#fff', fontSize: 34 },
  mWrap: { flex:1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  mContent: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 34 },
  mT: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  inp: { borderWidth:1, borderColor:'#cbd5e1', padding:13, borderRadius:10, marginBottom:9, fontSize:16 },
  camBtn: { backgroundColor: '#16a34a', padding: 14, alignItems: 'center', borderRadius: 11, marginTop: 6 },
  camTx: { color: '#fff', fontWeight: '700' },
  btn: { flex:1, paddingVertical: 14, alignItems:'center', borderRadius: 11 },
  btnTx: { color:'#fff', fontWeight: '700', fontSize: 15 },
});

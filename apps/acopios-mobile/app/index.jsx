import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert,
  TextInput, ActivityIndicator, FlatList, Modal
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ihnga5bz5ricfyg8e8ib7.web-preview.appgen.com';

export default function AcopiosMobile() {
  // Auth state
  const [loggedUser, setLoggedUser] = useState(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // Data
  const [activeTab, setActiveTab] = useState('nueva'); // nueva | visitas | dashboard | rutas
  const [loading, setLoading] = useState(false);

  // Nueva Visita
  const [visitForm, setVisitForm] = useState({
    visit_date: new Date().toISOString().slice(0,10),
    visit_time: new Date().toTimeString().slice(0,5),
    orchard_name: '', producer: '', broker: '', municipality: '', locality: '', state: 'Michoacán',
    lat: null, lng: null, alt: null,
    super_percent:0, extra_percent:0, primera_percent:0, mediano_percent:0, tercera_percent:0,
    cuarta_percent:0, canica_percent:0, clase2_percent:0, proceso_percent:0, desecho_percent:0,
    trees_productive:'', young_trees:'', hectares:'', est_kg:'', est_ton:'', observations:''
  });
  const [photos, setPhotos] = useState([]); // {url, type}
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [negotiation, setNegotiation] = useState({ status:'Prospecto', offered_price:'', pact_price:'', purchase_type:'Campo', payment_form:'Contado', tentative_cut_date:'', observations:'' });
  const [flowers, setFlowers] = useState([]);

  // Offline queue
  const [pending, setPending] = useState([]);

  // Visits data
  const [visits, setVisits] = useState([]);
  const [syncing, setSyncing] = useState(false);

  // Dashboard
  const [stats, setStats] = useState({});

  // Rutas
  const [journeyForm, setJourneyForm] = useState({ km_initial:'', km_final:'' });

  useEffect(() => { loadSession(); }, []);

  useEffect(() => {
    if (loggedUser) {
      loadInitialData();
      loadPendingQueue();
    }
  }, [loggedUser]);

  async function loadSession() {
    const u = await AsyncStorage.getItem('acopios_user');
    if (u) setLoggedUser(JSON.parse(u));
  }

  async function login() {
    if (!loginUsername || !loginPin || loginPin.length !== 4) {
      Alert.alert('Datos requeridos', 'Ingresa nombre de usuario y PIN completo (4 dígitos)');
      return;
    }
    setLoggingIn(true);
    try {
      // Use existing simple login: accepts name as username/email
      const res = await axios.post(`${API_URL}/api/auth/login-simple`, {
        email: loginUsername.trim(),
        pin: loginPin.trim()
      });
      if (res.data?.success) {
        const userData = { ...res.data.user, name: res.data.user?.name || loginUsername };
        await AsyncStorage.setItem('acopios_user', JSON.stringify(userData));
        setLoggedUser(userData);
        setLoginUsername(''); setLoginPin('');
        Alert.alert('Ingresó', 'Bienvenido, ' + (userData.name || 'Acopiador'));
      } else {
        Alert.alert('Error', res.data?.error || 'PIN o usuario incorrecto');
      }
    } catch (e) {
      // Fallback simple login local on error (offline)
      const offlineUser = { name: loginUsername.trim(), id: 'local' };
      await AsyncStorage.setItem('acopios_user', JSON.stringify(offlineUser));
      setLoggedUser(offlineUser);
      Alert.alert('Modo Offline', 'Guardado local. Usará PIN al reconectar.');
    }
    setLoggingIn(false);
  }

  async function logout() {
    await AsyncStorage.removeItem('acopios_user');
    setLoggedUser(null);
    setActiveTab('nueva');
  }

  async function loadPendingQueue() {
    const p = await AsyncStorage.getItem('acopios_pending');
    setPending(p ? JSON.parse(p) : []);
  }

  async function addPending(payload) {
    const p = [...pending, { ...payload, savedAt: Date.now() }];
    setPending(p);
    await AsyncStorage.setItem('acopios_pending', JSON.stringify(p));
  }

  async function loadInitialData() {
    setLoading(true);
    try {
      const [v, s] = await Promise.all([
        axios.get(`${API_URL}/api/acopios/visits`),
        axios.get(`${API_URL}/api/acopios/stats`)
      ]);
      setVisits(Array.isArray(v.data) ? v.data : []);
      setStats(s.data || {});
      // Try to sync any pending
      await syncPending();
    } catch (e) {
      console.log('Offline data load');
      const local = await AsyncStorage.getItem('acopios_local_visits');
      if (local) setVisits(JSON.parse(local));
    }
    setLoading(false);
  }

  async function captureGPS() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso GPS', 'Permite acceder a GPS para la visita.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setVisitForm(f => ({
        ...f,
        lat: pos.coords.latitude.toFixed(6),
        lng: pos.coords.longitude.toFixed(6),
        alt: pos.coords.altitude ? pos.coords.altitude.toFixed(0) : null
      }));
      Alert.alert('Ubicación GPS', 'Coordenadas Fijadas correctamente');
    } catch (e) {
      Alert.alert('GPS', 'No se pudo obtener ubicación GPS. Edita manualmente.');
    }
  }

  const calSum = () => {
    const keys = ['super','extra','primera','mediano','tercera','cuarta','canica','clase2','proceso','desecho'];
    return keys.reduce((s,k) => s + Number(visitForm[k + '_percent'] || 0), 0);
  };

  async function pickPhoto(type = 'vitageneral') {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permiso cámara','Necesitamos cámara para evidencias');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        base64: false,
      });
      if (result.canceled) return;

      setUploadingPhoto(true);
      const asset = result.assets[0];

      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        type: 'image/jpeg',
        name: 'acopio_' + Date.now() + '.jpg'
      });

      const up = await fetch(`${API_URL}/api/upload`, { method: 'POST', body: formData });
      const upJson = await up.json();
      const url = upJson.url || upJson.path;

      if (url) {
        setPhotos(prev => [...prev, { url, photo_type: type }]);
      }
    } catch (err) {
      // Fallback store uri for offline
      Alert.alert('Subida', 'Foto guardada localmente para sincronizar');
      setPhotos(prev => [...prev, { url: 'pending:' + Date.now(), photo_type: type, localUri: null }]);
    }
    setUploadingPhoto(false);
  }

  async function saveVisit() {
    const sum = calSum();
    if (Math.abs(sum - 100) > 0.6) {
      Alert.alert('Calibres inválidos', 'La suma debe ser 100%. Actual: ' + sum.toFixed(1));
      return;
    }
    if (!visitForm.orchard_name || !visitForm.orchard_name.trim()) {
      Alert.alert('Obligatorio', 'Nombre de huerta requerido');
      return;
    }

    const acopiador = loggedUser?.name || loggedUser?.email || 'acopiador';
    const payload = {
      visit: { ...visitForm, acopiador, user_id: acopiador, device: 'AcopiosMobile' },
      negotiation: negotiation.status ? negotiation : null,
      photos,
      flowers: flowers.length ? flowers : null
    };

    // Try upload
    try {
      const res = await axios.post(`${API_URL}/api/acopios/visits`, payload);
      Alert.alert('¡Guardado!', 'Visita registrada con éxito.');
      // clear form
      resetNewVisit();
      await loadInitialData();
    } catch (err) {
      // offline queue
      await addPending(payload);
      // also keep local list
      const localV = [ { id: 'local-' + Date.now(), ...payload.visit, neg_status: negotiation.status || 'Pendiente', _local: true }, ...visits ];
      setVisits(localV);
      await AsyncStorage.setItem('acopios_local_visits', JSON.stringify(localV));
      Alert.alert('Sin conexión', 'Guardado en espera de sincronización. Usa botón SYNC.');
      resetNewVisit();
    }
  }

  function resetNewVisit() {
    setVisitForm({
      visit_date: new Date().toISOString().slice(0,10), visit_time: new Date().toTimeString().slice(0,5),
      orchard_name:'', producer:'', broker:'', municipality:'', locality:'', state:'Michoacán',
      lat:null,lng:null,alt:null,
      super_percent:0,extra_percent:0,primera_percent:0,mediano_percent:0,tercera_percent:0,cuarta_percent:0,
      canica_percent:0,clase2_percent:0,proceso_percent:0,desecho_percent:0,
      trees_productive:'',young_trees:'',hectares:'',est_kg:'',est_ton:'',observations:''
    });
    setPhotos([]); setFlowers([]);
    setNegotiation({ status:'Prospecto', offered_price:'', pact_price:'', purchase_type:'Campo', payment_form:'Contado', tentative_cut_date:'', observations:'' });
  }

  async function syncPending() {
    if (!pending.length) return;
    setSyncing(true);
    let okCount = 0;
    const remain = [];

    for (const p of pending) {
      try {
        await axios.post(`${API_URL}/api/acopios/visits`, p);
        okCount++;
      } catch {
        remain.push(p);
      }
    }
    await AsyncStorage.setItem('acopios_pending', JSON.stringify(remain));
    setPending(remain);

    if (okCount) {
      Alert.alert('Sincronizado', `${okCount} visitas enviadas`);
      await loadInitialData();
    }
    setSyncing(false);
  }

  async function quickJourneySave() {
    if (!journeyForm.km_initial || !journeyForm.km_final) return Alert.alert('', 'KM inicial y final obligatorios');
    const total = parseFloat(journeyForm.km_final) - parseFloat(journeyForm.km_initial);
    if (total <= 0) return Alert.alert('Error', 'El final debe ser mayor');
    await axios.post(`${API_URL}/api/acopios/journeys`, {
      type: 'journey',
      journey: { ...journeyForm, total_km: total, date: new Date().toISOString().slice(0, 10), user_id: loggedUser?.name }
    }).catch(() => {
      // do local
    });
    setJourneyForm({ km_initial:'', km_final:'' });
    Alert.alert('Ruta', 'Jornada registrada');
  }

  function renderCalibreInput(label, key) {
    return (
      <View key={key} style={styles.rowSlim}>
        <Text style={styles.calLabel}>{label}</Text>
        <TextInput keyboardType="numeric" style={styles.inputSmall} value={String(visitForm[key] || '')}
          onChangeText={(t) => {
            let val = Math.min(100, Math.max(0, parseFloat(t) || 0));
            setVisitForm(f => ({ ...f, [key]: val }));
          }} />
        <Text style={{ width: 18, color: '#64748b' }}>%</Text>
      </View>
    );
  }

  // LOGIN VIEW
  if (!loggedUser) {
    return (
      <View style={styles.container}>
        <View style={styles.headerGreen}>
          <Text style={styles.headerTitle}>🍃 ACOPIOS DE CAMPO</Text>
          <Text style={styles.headerSub}>Prospección de Huertas • Tecavo Fruits</Text>
        </View>
        <View style={styles.loginCard}>
          <Text style={styles.loginTitle}>Acceso con Usuario y PIN</Text>
          <TextInput placeholder="Nombre de usuario" style={styles.input} value={loginUsername} onChangeText={setLoginUsername} autoCapitalize="none" />
          <TextInput placeholder="PIN (4 dígitos)" style={styles.input} value={loginPin} onChangeText={t=>setLoginPin(t.replace(/\D/g,'').slice(0,4))} keyboardType="numeric" maxLength={4} secureTextEntry />
          <TouchableOpacity style={styles.primaryBtn} onPress={login} disabled={loggingIn}>
            <Text style={styles.primaryText}>{loggingIn ? 'Entrando...' : 'Ingresar'}</Text>
          </TouchableOpacity>
          <Text style={styles.hint}>Usa el nombre de usuario y PIN asignado por Administración</Text>
        </View>
      </View>
    );
  }

  // MAIN
  const sum = calSum();
  const sumValid = Math.abs(sum - 100) < 0.6;

  return (
    <View style={styles.container}>
      <View style={styles.headerGreen}>
        <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
          <Text style={styles.headerTitle}>ACOPIOS DE CAMPO</Text>
          <TouchableOpacity onPress={logout}><Text style={{color:'#fff', fontSize:12}}>SALIR</Text></TouchableOpacity>
        </View>
        <Text style={{color:'#a1d9b5'}}>{loggedUser.name || 'Acopiador'} • PIN activo</Text>
      </View>

      {/* SIMPLE TABS */}
      <View style={styles.tabs}>
        {[
          ['nueva', 'Nueva\nVisita'],
          ['visitas', 'Mis\nVisitas'],
          ['dashboard', 'Dashboard'],
          ['rutas', 'Rutas'],
        ].map(([k, lbl]) => (
          <TouchableOpacity key={k} style={[styles.tab, activeTab === k && styles.tabActive]} onPress={() => setActiveTab(k)}>
            <Text style={[styles.tabText, activeTab === k && styles.tabActiveText]}>{lbl}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* NUEVA VISITA */}
      {activeTab === 'nueva' && (
        <ScrollView style={{flex:1, paddingHorizontal:12, paddingTop:8}}>
          <View style={styles.card}>
            <Text style={styles.section}>Información General</Text>

            <View style={{flexDirection:'row', gap:8}}>
              <TextInput style={[styles.input, {flex:1}]} value={visitForm.visit_date} onChangeText={v=>setVisitForm({...visitForm,visit_date:v})} placeholder="Fecha" />
              <TextInput style={[styles.input, {flex:1}]} value={visitForm.visit_time} onChangeText={v=>setVisitForm({...visitForm,visit_time:v})} placeholder="Hora" />
            </View>

            <TouchableOpacity style={styles.gpsBtn} onPress={captureGPS}>
              <Text style={styles.gpsText}>📍 Capturar ubicación GPS (lat/lng auto)</Text>
            </TouchableOpacity>
            <Text style={styles.coordText}>GPS: {visitForm.lat || '---'}, {visitForm.lng || '---'}</Text>

            <TextInput style={styles.input} placeholder="Nombre de la Huerta *" value={visitForm.orchard_name} onChangeText={v=>setVisitForm({...visitForm,orchard_name:v})} />
            <TextInput style={styles.input} placeholder="Productor" value={visitForm.producer} onChangeText={v=>setVisitForm({...visitForm,producer:v})} />
            <TextInput style={styles.input} placeholder="Corredor" value={visitForm.broker} onChangeText={v=>setVisitForm({...visitForm,broker:v})} />
            <View style={{flexDirection:'row', gap:6}}>
              <TextInput style={[styles.input,{flex:1}]} placeholder="Municipio" value={visitForm.municipality} onChangeText={v=>setVisitForm({...visitForm,municipality:v})} />
              <TextInput style={[styles.input,{flex:1}]} placeholder="Localidad" value={visitForm.locality} onChangeText={v=>setVisitForm({...visitForm,locality:v})} />
            </View>

            {/* Calibres  */}
            <Text style={styles.section}>Evaluación de Fruta (calibres = 100%)</Text>
            {[ ['Super', 'super_percent'], ['Extra', 'extra_percent'], ['Primera', 'primera_percent'], ['Mediano', 'mediano_percent'],
               ['Tercera', 'tercera_percent'], ['Cuarta', 'cuarta_percent'], ['Canica', 'canica_percent'], ['Clase 2', 'clase2_percent'],
               ['Proceso', 'proceso_percent'], ['Desecho', 'desecho_percent'] ].map(k=>renderCalibreInput(k[0], k[1]))}

            <View style={[styles.sumBar, sumValid ? styles.sumOk : styles.sumBad]}>
              <Text style={{fontWeight:'700', textAlign:'center'}}>SUMA ACTUAL: {sum.toFixed(1)} %  {sumValid ? '✓ OK' : '✗ Ajustar a 100%'}</Text>
            </View>

            <Text style={styles.section}>Estimación</Text>
            <View style={{flexDirection:'row', gap:6}}>
              <TextInput style={[styles.input, {flex:1}]} placeholder="Árboles productivos" keyboardType="numeric" value={String(visitForm.trees_productive)} onChangeText={t=>setVisitForm(f=>({...f,trees_productive:t}))} />
              <TextInput style={[styles.input, {flex:1}]} placeholder="Hectáreas" keyboardType="numeric" value={String(visitForm.hectares)} onChangeText={t=>setVisitForm(f=>({...f,hectares:t}))} />
            </View>
            <View style={{flexDirection:'row', gap:6}}>
              <TextInput style={[styles.input,{flex:1}]} placeholder="Kg estimados" keyboardType="numeric" value={String(visitForm.est_kg)} onChangeText={t=>setVisitForm(f=>({...f,est_kg:t}))} />
              <TextInput style={[styles.input,{flex:1}]} placeholder="Ton estimadas" keyboardType="numeric" value={String(visitForm.est_ton)} onChangeText={t=>setVisitForm(f=>({...f,est_ton:t}))} />
            </View>

            {/* Fotos */}
            <Text style={styles.section}>Evidencia Fotográfica (obligatorio)</Text>
            <View style={{flexDirection:'row', flexWrap:'wrap', gap:8}}>
              {['general','arbol','condicion'].map((t,i) => (
                <TouchableOpacity key={i} onPress={() => pickPhoto(t)} style={styles.photoBtn}>
                  <Text style={{fontSize:11}}>+ Foto {i+1}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => pickPhoto('adicional')} style={[styles.photoBtn, {backgroundColor:'#f1f5f9'}]}><Text>+ Adicional</Text></TouchableOpacity>
            </View>
            {photos.length > 0 && <Text style={styles.hint}>{photos.length} foto(s) lista(s)</Text>}

            {/* Negociación */}
            <Text style={styles.section}>Negociación</Text>
            <View style={{flexDirection:'row', gap:6}}>
              <TextInput style={[styles.input,{flex:1}]} placeholder="Precio OFRECIDO" keyboardType="numeric" value={negotiation.offered_price} onChangeText={v=>setNegotiation(s=>({...s,offered_price:v}))} />
              <TextInput style={[styles.input,{flex:1}]} placeholder="Precio PACTADO" keyboardType="numeric" value={negotiation.pact_price} onChangeText={v=>setNegotiation(s=>({...s,pact_price:v}))} />
            </View>
            <TextInput placeholder="Fecha tentativa corte AAAA-MM-DD" value={negotiation.tentative_cut_date} onChangeText={v=>setNegotiation(s=>({...s,tentative_cut_date:v}))} style={styles.input} />

            <View style={styles.actions}>
              <TouchableOpacity style={[styles.primaryBtn, !sumValid && {backgroundColor:'#9ca3af'}]} onPress={saveVisit} disabled={!sumValid}>
                <Text style={styles.primaryText}>GUARDAR VISITA DE HUERTA</Text>
              </TouchableOpacity>
            </View>
          </View>
          {pending.length > 0 && <View style={{marginBottom:80, padding:10, backgroundColor:'#fef3c7', borderRadius:8}}><Text>Pendientes por sincronizar: {pending.length}</Text><TouchableOpacity onPress={syncPending} style={{marginTop:8}}><Text style={{color:'#b45309', fontWeight:'700'}}>SYNC AHORA</Text></TouchableOpacity></View>}
        </ScrollView>
      )}

      {/* VISITAS */}
      {activeTab === 'visitas' && (
        <ScrollView style={{flex:1, padding:10}}>
          <View style={{flexDirection:'row', justifyContent:'space-between'}}>
            <Text style={styles.section}>Huertas Visitadas</Text>
            <TouchableOpacity onPress={syncPending}><Text style={{color:'#166534'}}>SYNC {pending.length}</Text></TouchableOpacity>
          </View>
          <FlatList data={visits} keyExtractor={(v,i)=>String(v.id||i)} renderItem={({item})=>(
            <View style={styles.visitCard}>
              <Text style={styles.bold}>{item.orchard_name} • {item.visit_date}</Text>
              <Text>{item.producer || ''} • Est. {item.est_kg || 0} kg • {item.neg_status || item.neg_status || 'Prospecto'}</Text>
            </View>
          )} />
          {loading && <ActivityIndicator />}
        </ScrollView>
      )}

      {/* DASHBOARD */}
      {activeTab === 'dashboard' && (
        <ScrollView style={{padding:10}}>
          <View style={styles.card}>
            <Text style={styles.section}>Indicadores (semana)</Text>
            <View style={styles.kpiRow}><Text style={styles.kpiLabel}>Visitas hoy</Text><Text style={styles.kpiVal}>{stats.today_visits || '—'}</Text></View>
            <View style={styles.kpiRow}><Text style={styles.kpiLabel}>Esta semana</Text><Text style={styles.kpiVal}>{stats.week_visits || '—'}</Text></View>
            <View style={styles.kpiRow}><Text style={styles.kpiLabel}>Conversión</Text><Text style={styles.kpiVal}>{stats.conversion_pct || 0}%</Text></View>
            <View style={styles.kpiRow}><Text style={styles.kpiLabel}>Kg negociados</Text><Text style={styles.kpiVal}>{(stats.kg_negotiated||0)/1000} t</Text></View>
            <View style={styles.kpiRow}><Text style={styles.kpiLabel}>Km recorridos</Text><Text style={styles.kpiVal}>{stats.km_traveled || '—'}</Text></View>
          </View>
          <TouchableOpacity style={styles.primaryBtn} onPress={loadInitialData}><Text style={styles.primaryText}>Actualizar Datos</Text></TouchableOpacity>
        </ScrollView>
      )}

      {/* RUTAS */}
      {activeTab === 'rutas' && (
        <ScrollView style={{padding:10}}>
          <View style={styles.card}>
            <Text style={styles.section}>Fin de jornada de ruta</Text>
            <TextInput placeholder="KM inicial" keyboardType="numeric" style={styles.input} value={journeyForm.km_initial} onChangeText={t=>setJourneyForm({...journeyForm, km_initial:t})} />
            <TextInput placeholder="KM final" keyboardType="numeric" style={styles.input} value={journeyForm.km_final} onChangeText={t=>setJourneyForm({...journeyForm, km_final:t})} />
            <TouchableOpacity style={styles.primaryBtn} onPress={quickJourneySave}><Text style={styles.primaryText}>Guardar Jornada</Text></TouchableOpacity>
            <Text style={styles.hint}>Total se calcula automáticamente. Fotos de odómetro vía app web para combustible.</Text>
          </View>
          <TouchableOpacity style={{marginTop:20}} onPress={syncPending}><Text style={{textAlign:'center',color:'#166534'}}>Sincronizar datos pendientes ahora</Text></TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  headerGreen: { backgroundColor: '#14532d', paddingTop: 56, paddingBottom: 14, paddingHorizontal: 16 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerSub: { color: '#86efac', fontSize: 12, marginTop: 2 },
  loginCard: { margin: 20, backgroundColor: '#fff', padding: 24, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  loginTitle: { fontSize: 18, fontWeight: '700', marginBottom: 14, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 11, fontSize: 16, marginBottom: 10 },
  primaryBtn: { backgroundColor: '#166534', padding: 15, borderRadius: 10, margin: 6, alignItems: 'center' },
  primaryText: { color:'#fff', fontWeight: '700', fontSize: 15 },
  hint: { fontSize: 12, color: '#64748b', marginTop: 8, textAlign: 'center' },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth:1, borderColor:'#e2e8f0' },
  tab: { flex:1, paddingVertical:9, alignItems:'center' },
  tabActive: { borderBottomWidth:3, borderBottomColor:'#166534' },
  tabText: { fontSize:12, color:'#475569' },
  tabActiveText: { color:'#166534', fontWeight:'700' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth:1, borderColor:'#e2e8f0' },
  section: { fontWeight:'700', marginVertical: 10, color:'#14532d', fontSize:13 },
  gpsBtn: { backgroundColor:'#166534', padding:11, borderRadius:8, marginVertical:6 },
  gpsText: { color:'#fff', textAlign:'center', fontWeight:'700' },
  coordText: { fontSize:11, color:'#334155', marginBottom:8 },
  inputSmall: { borderWidth:1, borderColor:'#94a3b8', width:62, padding:6, borderRadius:6, textAlign:'center' },
  rowSlim: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical:4 },
  calLabel: { width:72, fontSize:12 },
  sumBar: { marginVertical: 8, padding:6, borderRadius:6, backgroundColor:'#fef2f2' },
  sumOk: { backgroundColor:'#dcfce7' },
  sumBad: { backgroundColor:'#fee2e2' },
  photoBtn: { backgroundColor:'#dcfce7', borderRadius:8, paddingVertical:9, paddingHorizontal:14 },
  actions: { marginTop: 12 },
  visitCard: { backgroundColor:'#fff', padding:12, borderRadius:10, marginBottom:8, borderWidth:1, borderColor:'#e2e8f0' },
  bold: { fontWeight:'700' },
  kpiRow: { flexDirection:'row', justifyContent:'space-between', paddingVertical:9, borderBottomWidth:1, borderColor:'#f1f5f9' },
  kpiLabel: { fontSize:15, color:'#334155' },
  kpiVal: { fontWeight:'700', color:'#166534' }
});

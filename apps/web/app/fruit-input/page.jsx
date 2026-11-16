'use client';

import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { useScaleDevice } from '@/hooks/useScaleDevice';

export default function FruitInputPage() {
  const router = useRouter();
  const [weighings, setWeighings] = useState([]);
  const [user, setUser] = useState(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [scaleDevices, setScaleDevices] = useState([]);
  const [selectedScaleDevice, setSelectedScaleDevice] = useState(null);
  const [useScaleSync, setUseScaleSync] = useState(false);

  const { weight, isConnected, connectionStatus, connect, disconnect } = useScaleDevice(selectedScaleDevice?.id, useScaleSync);
  const [currentLot, setCurrentLot] = useState({
    lotNumber: 'TCV-FTS-0001',
    producer: '',
    orchardName: '',
    municipality: '',
    fruitPrice: '',
    orchardRegistry: '',
    guideFolio: '',
    collectorName: '',
    brokerName: '',
    brokerPhone: '',
    commissionAmount: '',
    paymentDays: '',
    date: new Date().toISOString().split('T')[0],
    isPackingHouse: false,
    freightPaid: false,
    crewPaid: false,
    isCuttingFruit: false
  });
  const [currentWeighing, setCurrentWeighing] = useState({
    boxes: '',
    grossWeight: '',
    withPallet: false,
    photo: null,
    photoPreview: null,
    // FASE 05: Dos evidencias independientes
    guiaCampoPhoto: null,
    guiaCampoPreview: null,
    boletaBasculaPhoto: null,
    boletaBasculaPreview: null,
    operation: 'ingreso_fruta',
    origin: 'manual'
  });
  const [lotCreated, setLotCreated] = useState(false);
  const [lotId, setLotId] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState(null);
  const [weightHistory, setWeightHistory] = useState([]);
  const [lastUpdateTime, setLastUpdateTime] = useState(null);
  const [totalKgPublicScale, setTotalKgPublicScale] = useState('');
  const [publicScaleDate, setPublicScaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [publicScaleNotes, setPublicScaleNotes] = useState('');
  const [savedPublicScale, setSavedPublicScale] = useState(false);
  const [cameraRetryStatus, setCameraRetryStatus] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [cuttingOrders, setCuttingOrders] = useState([]);
  const [selectedCuttingFolio, setSelectedCuttingFolio] = useState('');
  const [selectedCuttingOrderId, setSelectedCuttingOrderId] = useState(null);
  const [externalApiUrl, setExternalApiUrl] = useState('https://3000-i3pfq0sojvsvummwhtsd9.prev.appgen.com');
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [accountantLink, setAccountantLink] = useState(null);
  const [showAccountantLinkModal, setShowAccountantLinkModal] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Check if user is super admin and load scale devices
  useEffect(() => {
    const checkUserPermissions = async () => {
      try {
        const userResponse = await fetch('/api/auth/user', {
          credentials: 'include',
        });
        if (userResponse.ok) {
          const userData = await userResponse.json();
          setUser(userData);
          
          if (userData.email === 'demo@appgen.com') {
            setIsSuperAdmin(true);
          }

          try {
            const scaleRes = await fetch(`/api/scale-devices?userId=${userData.id}`);
            if (scaleRes.ok) {
              const scales = await scaleRes.json();
              setScaleDevices(scales);
              const enabledScale = scales.find(s => s.is_enabled);
              if (enabledScale) {
                setSelectedScaleDevice(enabledScale);
              }
            }
          } catch (error) {
            console.error('Error loading scale devices:', error);
          }
        }
      } catch (error) {
        console.error('Error checking user permissions:', error);
      }
    };
    
    checkUserPermissions();
  }, []);

  // Load available cutting orders folios for trazabilidad (choose to assign lot)
  useEffect(() => {
    const loadCuttingOrders = async () => {
      try {
        const res = await fetch('/api/cutting-orders');
        if (res.ok) {
          const data = await res.json();
          // Prefer pending or not completed ones, but include all for traceability option
          setCuttingOrders(Array.isArray(data) ? data : []);
        }
      } catch (e) { console.error('No se pudieron cargar órdenes de corte', e); }
    };
    loadCuttingOrders();
  }, []);

  // Auto-populate gross weight from scale and track history
  useEffect(() => {
    if (weight && useScaleSync && selectedScaleDevice) {
      setCurrentWeighing(prev => ({
        ...prev,
        grossWeight: weight.toString()
      }));
      
      // Add to weight history with timestamp
      setWeightHistory(prev => {
        const newHistory = [...prev, { value: weight, time: new Date() }];
        // Keep only last 20 readings
        return newHistory.slice(-20);
      });
      
      setLastUpdateTime(new Date());
    }
  }, [weight, useScaleSync, selectedScaleDevice]);

  // Generate automatic lot number
  useEffect(() => {
    const generateLotNumber = async () => {
      try {
        const response = await fetch('/api/lots/next-number');
        
        if (!response.ok) {
          throw new Error('Error al obtener número de lote');
        }
        
        const data = await response.json();
        
        if (!data.lotNumber) {
          throw new Error('Número de lote inválido');
        }
        
        setCurrentLot(prev => ({ ...prev, lotNumber: data.lotNumber }));
      } catch (error) {
        console.error('Error generating lot number:', error);
        // Fallback to TCV-FTS-0001 if API fails
        setCurrentLot(prev => ({ ...prev, lotNumber: 'TCV-FTS-0001' }));
        alert('Advertencia: No se pudo generar el número de lote automático. Se ha asignado TCV-FTS-0001. Verifica tu conexión.');
      }
    };
    
    generateLotNumber();
  }, []);

  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);
  const [rotGuia, setRotGuia] = useState(0);
  const [rotBoleta, setRotBoleta] = useState(0);

  // Enhanced auto recovery from Orden de Corte (full fields: productor, huerta, corredor, transportista, cuadrilla, cajas, fecha, condiciones)
  const handleSelectCuttingFolio = async (e) => {
    const folio = e.target.value;
    setSelectedCuttingFolio(folio);
    
    if (!folio) {
      setSelectedCuttingOrderId(null);
      setSelectedOrderDetails(null);
      return;
    }
    
    let ord = cuttingOrders.find(o => o.folio === folio || String(o.id) === folio);
    
    // Fetch full details for complete recovery (cuadrilla, camion, transportista, cajas, condiciones)
    try {
      const detailRes = await fetch(`/api/cutting-orders?folio=${encodeURIComponent(folio)}`);
      if (detailRes.ok) {
        const details = await detailRes.json();
        if (Array.isArray(details) && details[0]) ord = { ...ord, ...details[0] };
        else if (details && details.id) ord = { ...ord, ...details };
      }
    } catch (_) {}
    
    if (ord) {
      setSelectedCuttingOrderId(ord.id);
      setSelectedOrderDetails(ord);
      
      // Full automatic recovery respecting original order data
      setCurrentLot(prev => ({
        ...prev,
        producer: ord.producer_name || prev.producer,
        orchardName: ord.orchard_name || prev.orchardName,
        date: ord.cutting_date || prev.date,
        brokerName: ord.broker_name || prev.brokerName || ord.collector_name || '',
        commissionAmount: (ord.agreed_commission != null ? ord.agreed_commission : (prev.commissionAmount || '')),
        fruitPrice: (ord.agreed_price_per_kg != null ? ord.agreed_price_per_kg : (prev.fruitPrice || '')),
        paymentDays: ord.payment_days != null ? ord.payment_days : (prev.paymentDays || '7'),
        orchardRegistry: ord.orchard_registry || prev.orchardRegistry || '',
        guideFolio: ord.guide_folio || prev.guideFolio || '',
      }));

      if (ord.lot_id) {
        try {
          const lotRes = await fetch(`/api/lots`);
          const allLots = lotRes.ok ? await lotRes.json() : [];
          const linkedLot = allLots.find(l => l.id === ord.lot_id);
          if (linkedLot) {
            setCurrentLot(prev => ({
              ...prev,
              lotNumber: linkedLot.lot_number,
              producer: linkedLot.producer || prev.producer,
              orchardName: linkedLot.orchard_name || prev.orchardName,
              orchardRegistry: linkedLot.orchard_registry || prev.orchardRegistry || '',
              guideFolio: linkedLot.guide_folio || prev.guideFolio || '',
              fruitPrice: (linkedLot.fruit_price != null ? linkedLot.fruit_price : prev.fruitPrice),
            }));
            setLotId(linkedLot.id);
            setLotCreated(true);
          }
        } catch (_) {}
      }
    }
  };

  // Camera functions
  const startCamera = async (retries = 3, delay = 2000) => {
    try {
      // Stop any existing camera stream before starting a new one
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }

      // Check if mediaDevices is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Tu navegador no soporta acceso a la cámara');
      }

      // Start with basic constraints, fallback to less ideal if needed
      let constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      };
      
      let mediaStream;
      let lastError;
      
      // Retry logic for camera access
      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          // Show retry status to user
          setCameraRetryStatus(`Inicializando cámara... Intento ${attempt + 1} de ${retries}`);
          
          mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
          setCameraRetryStatus(null); // Clear status on success
          break; // Success, exit retry loop
        } catch (err) {
          lastError = err;
          
          // If ideal constraints fail, try with minimum constraints
          if (err.name === 'OverconstrainedError') {
            console.log('Retrying with basic constraints...');
            constraints = {
              video: {
                facingMode: 'environment'
              },
              audio: false
            };
            try {
              setCameraRetryStatus(`Inicializando cámara... Intento ${attempt + 1} de ${retries}`);
              mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
              setCameraRetryStatus(null); // Clear status on success
              break; // Success, exit retry loop
            } catch (basicErr) {
              lastError = basicErr;
            }
          }
          
          // If this is a NotReadableError (camera busy) and we have retries left, wait and retry
          if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
            if (attempt < retries - 1) {
              console.log(`Cámara ocupada, reintentando en ${delay}ms... (intento ${attempt + 1}/${retries})`);
              setCameraRetryStatus(`Inicializando cámara... Intento ${attempt + 1} de ${retries}`);
              await new Promise(resolve => setTimeout(resolve, delay));
              continue; // Retry
            } else {
              // Last attempt failed
              setCameraRetryStatus(null);
              throw new Error('La cámara no está disponible después de 3 intentos. Por favor intenta usar "Subir Foto".');
            }
          }
          
          throw err;
        }
      }
      
      if (!mediaStream) {
        throw lastError || new Error('No se pudo acceder a la cámara después de varios intentos');
      }
      
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        // Wait for video to be ready
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch(err => {
            console.error('Error playing video:', err);
          });
        };
      }
      
      setShowCamera(true);
    } catch (error) {
      setCameraRetryStatus(null);
      let errorMessage = 'No se pudo acceder a la cámara.';
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = 'Para tomar fotos, por favor permite el acceso a la cámara cuando tu navegador lo solicite. También puedes usar el botón "Subir Foto" para seleccionar una imagen desde tu galería.';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage = 'No se encontró cámara. Usa el botón "Subir Foto" para seleccionar una imagen desde tu galería.';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage = 'La cámara está ocupada o no disponible. Intenta:\n1. Cierra otras apps o pestañas que usen la cámara\n2. Recarga esta página\n3. O usa el botón "Subir Foto" para seleccionar una imagen desde tu galería.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'La cámara no soporta los requisitos especificados. Usa el botón "Subir Foto" para seleccionar una imagen desde tu galería.';
      } else if (error.name === 'NotSupportedError') {
        errorMessage = 'Tu navegador no soporta cámara. Usa Chrome, Safari o Edge, o el botón "Subir Foto".';
      }
      
      alert(errorMessage);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setShowCamera(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) {
      console.error('❌ Video or canvas ref not available');
      return;
    }
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    console.log('📸 Capturing photo...');
    console.log('Video dimensions:', video.videoWidth, 'x', video.videoHeight);
    
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.error('❌ Video not ready');
      alert('La cámara aún no está lista. Espera un momento e intenta de nuevo.');
      return;
    }
    
    const context = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);
    
    console.log('✅ Photo drawn to canvas');
    
    canvas.toBlob((blob) => {
      if (!blob) {
        console.error('❌ Failed to create blob from canvas');
        alert('Error al capturar la foto. Intenta de nuevo.');
        return;
      }
      
      console.log('✅ Blob created:', blob.size, 'bytes');
      
      const file = new File([blob], `weighing-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const preview = canvas.toDataURL('image/jpeg');
      
      console.log('✅ File created:', file.name, file.size, 'bytes');
      console.log('✅ Preview URL length:', preview.length);
      
      setCurrentWeighing(prev => ({ 
        ...prev, 
        photo: file,
        photoPreview: preview
      }));
      
      stopCamera();
      console.log('✅ Photo captured successfully');
    }, 'image/jpeg', 0.85);
  };

  // FASE 05: Captura para tipo específico (guia / boleta)
  const [cameraTarget, setCameraTarget] = useState(null); // 'guia' | 'boleta' | null
  const startCameraFor = async (target) => {
    setCameraTarget(target);
    await startCamera();
  };

  // Capturar y asignar según target
  const capturePhotoForTarget = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `ev-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const preview = canvas.toDataURL('image/jpeg');
      if (cameraTarget === 'guia') {
        setCurrentWeighing(p => ({...p, guiaCampoPhoto: file, guiaCampoPreview: preview}));
      } else if (cameraTarget === 'boleta') {
        setCurrentWeighing(p => ({...p, boletaBasculaPhoto: file, boletaBasculaPreview: preview}));
      } else {
        setCurrentWeighing(p => ({...p, photo: file, photoPreview: preview}));
      }
      stopCamera();
      setCameraTarget(null);
    }, 'image/jpeg', 0.85);
  };

  // Captura estable desde báscula (requiere 3 lecturas dentro de 0.5kg)
  const captureStableFromScale = () => {
    if (!weightHistory || weightHistory.length < 3) {
      alert('Necesitas al menos 3 lecturas estables de la escala. Espera lecturas.');
      return;
    }
    const last3 = weightHistory.slice(-3).map(w => w.value);
    const max = Math.max(...last3);
    const min = Math.min(...last3);
    if (max - min > 0.5) {
      alert('Lectura inestable. Espera que el peso se estabilice (±0.5 kg).');
      return;
    }
    const stable = last3[last3.length-1];
    setCurrentWeighing(p => ({...p, grossWeight: stable.toFixed(2), origin: 'bascula_auto'}));
    alert(`✓ Pesada capturada desde báscula: ${stable.toFixed(2)} kg (estable)`);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    console.log('📁 File selected:', file);
    
    if (file) {
      console.log('File details:', {
        name: file.name,
        size: file.size,
        type: file.type
      });
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Por favor selecciona un archivo de imagen válido (JPG, PNG, etc.)');
        return;
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('La imagen es demasiado grande. Por favor selecciona una imagen menor a 10MB.');
        return;
      }
      
      const reader = new FileReader();
      
      reader.onload = (e) => {
        console.log('✅ File read successfully');
        setCurrentWeighing(prev => ({
          ...prev,
          photo: file,
          photoPreview: e.target?.result
        }));
      };
      
      reader.onerror = (error) => {
        console.error('❌ Error reading file:', error);
        alert('No se pudo leer el archivo. Por favor intenta seleccionar otra imagen o reinicia la aplicación.');
      };
      
      reader.readAsDataURL(file);
    }
  };

  // Load public scale weighing when lot is created
  useEffect(() => {
    const loadPublicScaleWeighing = async () => {
      if (lotCreated && lotId) {
        try {
          const res = await fetch(`/api/fruit-input-weighings?lotId=${lotId}`);
          if (res.ok) {
            const data = await res.json();
            if (data) {
              setTotalKgPublicScale(data.total_kg_weighed);
              setPublicScaleDate(data.public_scale_date);
              setPublicScaleNotes(data.notes || '');
              setSavedPublicScale(true);
            }
          }
        } catch (error) {
          console.error('Error loading public scale weighing:', error);
        }
      }
    };
    loadPublicScaleWeighing();
  }, [lotCreated, lotId]);

  // Save public scale weighing + propagate to FULL chain: Cuadrillas + Corredores (comisión) + Programación de Pagos
  const savePublicScaleWeighing = async () => {
    if (!lotId || !totalKgPublicScale) {
      alert('Por favor completa todos los campos de la báscula pública');
      return;
    }

    try {
      const kg = parseFloat(totalKgPublicScale);

      const response = await fetch('/api/fruit-input-weighings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lot_id: lotId,
          total_kg_weighed: kg,
          public_scale_date: publicScaleDate,
          notes: publicScaleNotes
        })
      });

      if (!response.ok) {
        throw new Error('Error al guardar');
      }

      setSavedPublicScale(true);

      // Update lote with real kilos received
      await fetch(`/api/lots`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: lotId,
          total_kg_received: kg,
          lot_traceability_status: 'ingreso_completed'
        })
      });

      // *** CREAR PROGRAMACIÓN DE PAGO DE FRUTA AUTOMÁTICA (usando días y datos del lote) + comisión corredores
      try {
        const lotRes = await fetch(`/api/lots`);
        const allLots = lotRes.ok ? await lotRes.json() : [];
        const lot = allLots.find(l => l.id === lotId);
        
        if (lot && lot.payment_days) {
          // Crear registro programado
          await fetch('/api/payment-schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              producer_name: lot.producer || currentLot.producer,
              beneficiary_name: lot.producer || currentLot.producer,
              concept: `Fruta Lote ${lot.lot_number} - Corte ${selectedCuttingFolio || ''}`,
              amount: (kg * parseFloat(lot.fruit_price || currentLot.fruitPrice || 0)).toFixed(2),
              fruit_reception_date: lot.date || currentLot.date,
              payment_days: parseInt(lot.payment_days || currentLot.paymentDays || 7),
              priority: 'normal'
            })
          });

          // Marcar comisión en corredores (broker payments)
          if (lot.commission_amount > 0 && (lot.collector_name || currentLot.collectorName)) {
            await fetch('/api/brokers', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                lotId: lotId,
                isPaid: false,
                paidDate: null
              })
            });
          }
        }
      } catch (e) { /* no bloquear */ }

      alert('✓ Kilos guardados. Trazabilidad completa propagada: Cuadrillas + Corredores (Comisión) + Programación Pagos.');
    } catch (error) {
      console.error('Error saving public scale weighing:', error);
      alert('No se pudieron guardar los kilos pesados e integrar pagos. Por favor verifica los datos.');
    }
  };

  // Create lot
  const createLot = async () => {
    // Validación detallada de campos
    const errors = [];
    
    if (!currentLot.lotNumber || !currentLot.lotNumber.trim()) {
      errors.push('Número de lote');
    }
    if (!currentLot.producer || !currentLot.producer.trim()) {
      errors.push('Productor');
    }
    if (!currentLot.orchardName || !currentLot.orchardName.trim()) {
      errors.push('Huerta');
    }
    if (!currentLot.municipality || !currentLot.municipality.trim()) {
      errors.push('Municipio');
    }
    if (!currentLot.date) {
      errors.push('Fecha');
    }
    if (!currentLot.collectorName || !currentLot.collectorName.trim()) {
      errors.push('Acopiador');
    }
    
    if (errors.length > 0) {
      alert(`Por favor completa correctamente los siguientes campos:\n\n• ${errors.join('\n• ')}`);
      return;
    }

    try {
      const payload = {
        lot_number: currentLot.lotNumber,
        producer: currentLot.producer,
        orchard_name: currentLot.orchardName,
        municipality: currentLot.municipality,
        fruit_type: 'Aguacate',
        date: currentLot.date,
        fruit_price: parseFloat(currentLot.fruitPrice) || 0,
        collector_name: currentLot.collectorName,
        commission_amount: parseFloat(currentLot.commissionAmount) || 0,
        payment_days: parseInt(currentLot.paymentDays) || 7,
        is_cut_fruit: currentLot.isCuttingFruit,
        fruit_source: currentLot.isPackingHouse ? 'empaque' : 'acopio',
        freight_paid: currentLot.freightPaid,
        crew_paid: currentLot.crewPaid,
        broker_name: currentLot.brokerName || currentLot.collectorName,
        broker_phone: currentLot.brokerPhone || '',
        orchard_registry: currentLot.orchardRegistry || '',
        guide_folio: currentLot.guideFolio || ''
      };
      // *** ASIGNACIÓN PERFECTA DE TRAZABILIDAD: vincular lote con folio de orden de corte + comisión a corredor ***
      if (selectedCuttingOrderId) {
        payload.cutting_order_id = selectedCuttingOrderId;
        payload.cutting_order_folio = selectedCuttingFolio;
      }
      const response = await fetch('/api/lots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      
      if (!response.ok) {
        // Manejar errores del servidor
        if (response.status === 409) {
          // Número de lote duplicado
          alert(data.error || 'El número de lote ya existe. Por favor genera uno nuevo.');
          // Regenerar número de lote automáticamente
          try {
            const nextNumberResponse = await fetch('/api/lots/next-number');
            const nextNumberData = await nextNumberResponse.json();
            setCurrentLot(prev => ({ ...prev, lotNumber: nextNumberData.lotNumber }));
          } catch (err) {
            console.error('Error regenerating lot number:', err);
          }
          return;
        } else if (response.status === 400) {
          // Error de validación
          alert(data.error || 'Error de validación. Por favor verifica los datos.');
          return;
        } else {
          // Otro error del servidor
          alert(data.error || 'Error al crear el lote. Por favor intenta nuevamente.');
          return;
        }
      }
      
      // Éxito
      setLotId(data.id);
      setLotCreated(true);

      // Trazabilidad: vincular el lote creado hacia la orden de corte (si se eligió folio)
      if (selectedCuttingOrderId) {
        try {
          await fetch('/api/cutting-orders', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: selectedCuttingOrderId, lot_id: data.id })
          });
        } catch (_) {}
      }
      
      // Generar PIN para acceso de contador (usuarios externos) - gestionado en módulo independiente Documentación
      try {
        await fetch(`/api/lots/${data.id}/accountant-link`, { method: 'POST' });
        // PIN generado. Usar el módulo Documentación para ver y compartir el acceso para subida de documentos de cobro.
      } catch (error) {
        console.error('Error generating contador PIN:', error);
      }
      
      alert(`✓ Lote ${currentLot.lotNumber} creado exitosamente.\n\nAhora puedes agregar pesadas.`);
    } catch (error) {
      console.error('Error creating lot:', error);
      alert('Error de conexión al crear el lote. Por favor verifica tu conexión a internet e intenta nuevamente.');
    }
  };

  // Add weighing - FASE 05: soporta dos evidencias + origen + operación
  const addWeighing = async () => {
    if (!currentWeighing.boxes || !currentWeighing.grossWeight) {
      alert('Por favor completa cajas y peso bruto');
      return;
    }

    if (!lotCreated) {
      alert('Primero debes crear el lote');
      return;
    }

    try {
      let photoUrl = null;
      let guiaUrl = null;
      let boletaUrl = null;

      // Upload legacy + new two photos if present
      const uploadOne = async (f) => {
        if (!f) return null;
        const fd = new FormData(); fd.append('file', f);
        const r = await fetch('/api/upload', { method:'POST', body: fd });
        const d = await r.json();
        return d.url || null;
      };

      photoUrl = await uploadOne(currentWeighing.photo);
      guiaUrl = await uploadOne(currentWeighing.guiaCampoPhoto);
      boletaUrl = await uploadOne(currentWeighing.boletaBasculaPhoto);

      // Calculate tare and net weight
      const boxes = parseInt(currentWeighing.boxes);
      const boxTare = boxes * 2;
      const palletTare = currentWeighing.withPallet ? 22 : 0;
      const totalTare = boxTare + palletTare;
      const grossWeight = parseFloat(currentWeighing.grossWeight);
      const netWeight = grossWeight - totalTare;

      // Save individual weighing with extra fields
      const response = await fetch('/api/weighings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lot_id: lotId,
          boxes: boxes,
          gross_weight: grossWeight,
          with_pallet: currentWeighing.withPallet,
          net_weight: netWeight,
          tare_weight: totalTare,
          photo_url: photoUrl,
          operation: currentWeighing.operation || 'ingreso_fruta',
          origin: currentWeighing.origin || 'manual'
        })
      });

      const weighing = await response.json();
      
      setWeighings([...weighings, {
        ...weighing,
        photoPreview: currentWeighing.photoPreview,
        guiaCampoPreview: currentWeighing.guiaCampoPreview,
        boletaBasculaPreview: currentWeighing.boletaBasculaPreview
      }]);

      // Also attach to fruit_input_weighings if first time or update totals
      if (guiaUrl || boletaUrl) {
        await fetch('/api/fruit-input-weighings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lot_id: lotId,
            total_kg_weighed: netWeight,
            public_scale_date: new Date().toISOString().slice(0,10),
            notes: 'Evidencias adjuntas',
            guia_campo_url: guiaUrl,
            boleta_bascula_url: boletaUrl
          })
        });
      }

      // Reset
      setCurrentWeighing({
        boxes: '', grossWeight: '', withPallet: false,
        photo: null, photoPreview: null,
        guiaCampoPhoto: null, guiaCampoPreview: null,
        boletaBasculaPhoto: null, boletaBasculaPreview: null,
        operation: 'ingreso_fruta', origin: 'manual'
      });

      alert('Pesada agregada exitosamente');
    } catch (error) {
      console.error('Error adding weighing:', error);
      alert('Error al guardar la pesada. Por favor verifica que todos los datos sean correctos e intenta nuevamente.');
    }
  };

  // Print label (configurable thermal label)
  const printLabel = (weighing) => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Etiqueta - ${currentLot.lotNumber}</title>
        <style>
          @page { size: 4in 3in; margin: 0; }
          body { font-family: Arial, sans-serif; margin: 0; padding: 5mm; width: 4in; height: 3in; }
          .title { font-weight: bold; font-size: 14pt; text-align: center; border-bottom: 1px solid #000; padding-bottom: 2mm; }
          .row { font-size: 11pt; margin: 2mm 0; }
        </style>
      </head>
      <body>
        <div class="title">TECAVO FRUITS</div>
        <div class="row">Lote: ${currentLot.lotNumber}</div>
        <div class="row">Cajas: ${weighing.boxes || ''}</div>
        <div class="row">Peso Bruto: ${weighing.gross_weight || ''} kg</div>
        <div class="row">Peso Neto: ${weighing.net_weight || ''} kg</div>
        <div class="row" style="text-align:center; font-family: monospace; font-size: 16pt; margin-top: 4mm;">*${currentLot.lotNumber}*</div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  };

  // Print intake note (media carta, 2 copias)
  const printIntakeNote = () => {
    const totalBoxes = weighings.reduce((sum, w) => sum + parseInt(w.boxes), 0);
    const totalNetWeight = weighings.reduce((sum, w) => sum + parseFloat(w.net_weight), 0);
    const totalValue = totalNetWeight * parseFloat(currentLot.fruitPrice);

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Nota de Ingreso - ${currentLot.lotNumber}</title>
        <style>
          @page { size: 5.5in 8.5in; margin: 10mm; }
          body { 
            font-family: Arial, sans-serif; 
            margin: 0;
            padding: 0;
            font-size: 10pt;
          }
          .copy {
            page-break-after: always;
            height: 8.5in;
          }
          .copy:last-child {
            page-break-after: auto;
          }
          .header { 
            text-align: center; 
            font-weight: bold; 
            font-size: 14pt;
            border-bottom: 2px solid #000;
            padding-bottom: 5mm;
            margin-bottom: 5mm;
          }
          .copy-label {
            text-align: right;
            font-size: 8pt;
            color: #666;
            margin-bottom: 3mm;
          }
          .section { 
            margin: 5mm 0;
          }
          .section-title {
            font-weight: bold;
            font-size: 11pt;
            border-bottom: 1px solid #000;
            margin-bottom: 3mm;
          }
          .row { 
            display: flex;
            justify-content: space-between;
            margin: 2mm 0;
          }
          .field { 
            flex: 1;
          }
          .label { 
            font-weight: bold;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 3mm 0;
          }
          th, td {
            border: 1px solid #000;
            padding: 2mm;
            text-align: center;
          }
          th {
            background: #e0e0e0;
            font-weight: bold;
          }
          .totals {
            margin-top: 5mm;
            padding: 3mm;
            background: #f0f0f0;
            border: 2px solid #000;
          }
          .signature {
            margin-top: 10mm;
            text-align: center;
          }
          .signature-line {
            border-top: 1px solid #000;
            width: 200px;
            margin: 20mm auto 2mm;
          }
        </style>
      </head>
      <body>
        <!-- COPIA 1: PRODUCTOR -->
        <div class="copy">
          <div class="copy-label">COPIA PARA PRODUCTOR</div>
          <div class="header">
            NOTA DE INGRESO DE FRUTA<br><div style='font-size:9px'>EMPAQUE — incluye logo + datos generales (se actualiza con branding actual)</div>
            <span style="font-size: 12pt;">TECAVO FRUITS</span>
          </div>
          
          <div class="section">
            <div class="section-title">Información del Lote</div>
            <div class="row">
              <div class="field"><span class="label">Lote:</span> ${currentLot.lotNumber}</div>
              <div class="field"><span class="label">Fecha:</span> ${new Date(currentLot.date).toLocaleDateString('es-MX')}</div>
            </div>
            <div class="row">
              <div class="field"><span class="label">Productor:</span> ${currentLot.producer}</div>
              <div class="field"><span class="label">Huerta:</span> ${currentLot.orchardName}</div>
            </div>
            <div class="row">
              <div class="field"><span class="label">Corredor:</span> ${currentLot.collectorName}</div>
              <div class="field"><span class="label">Precio/kg:</span> $${parseFloat(currentLot.fruitPrice).toFixed(2)}</div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Detalle de Pesadas</div>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Cajas</th>
                  <th>Peso Bruto</th>
                  <th>Tara</th>
                  <th>Peso Neto</th>
                  <th>Tarima</th>
                </tr>
              </thead>
              <tbody>
                ${weighings.map((w, i) => `
                  <tr>
                    <td>${i + 1}</td>
                    <td>${w.boxes}</td>
                    <td>${w.gross_weight} kg</td>
                    <td>${w.tare_weight} kg</td>
                    <td>${w.net_weight} kg</td>
                    <td>${w.with_pallet ? 'Sí' : 'No'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="totals">
            <div class="row">
              <div><span class="label">Total de Cajas:</span> ${totalBoxes}</div>
              <div><span class="label">Total Peso Neto:</span> ${totalNetWeight.toFixed(2)} kg</div>
            </div>
            <div class="row" style="margin-top: 3mm; font-size: 12pt;">
              <div><span class="label">TOTAL A PAGAR:</span> $${totalValue.toFixed(2)}</div>
            </div>
          </div>

          <div class="signature">
            <div class="signature-line"></div>
            <div>Firma del Productor</div>
          </div>
        </div>

        <!-- COPIA 2: EMPAQUE -->
        <div class="copy">
          <div class="copy-label">COPIA PARA EMPAQUE</div>
          <div class="header">
            NOTA DE INGRESO DE FRUTA<br>
            <span style="font-size: 12pt;">TECAVO FRUITS</span>
          </div>
          
          <div class="section">
            <div class="section-title">Información del Lote</div>
            <div class="row">
              <div class="field"><span class="label">Lote:</span> ${currentLot.lotNumber}</div>
              <div class="field"><span class="label">Fecha:</span> ${new Date(currentLot.date).toLocaleDateString('es-MX')}</div>
            </div>
            <div class="row">
              <div class="field"><span class="label">Productor:</span> ${currentLot.producer}</div>
              <div class="field"><span class="label">Huerta:</span> ${currentLot.orchardName}</div>
            </div>
            <div class="row">
              <div class="field"><span class="label">Corredor:</span> ${currentLot.collectorName}</div>
              <div class="field"><span class="label">Precio/kg:</span> $${parseFloat(currentLot.fruitPrice).toFixed(2)}</div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Detalle de Pesadas</div>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Cajas</th>
                  <th>Peso Bruto</th>
                  <th>Tara</th>
                  <th>Peso Neto</th>
                  <th>Tarima</th>
                </tr>
              </thead>
              <tbody>
                ${weighings.map((w, i) => `
                  <tr>
                    <td>${i + 1}</td>
                    <td>${w.boxes}</td>
                    <td>${w.gross_weight} kg</td>
                    <td>${w.tare_weight} kg</td>
                    <td>${w.net_weight} kg</td>
                    <td>${w.with_pallet ? 'Sí' : 'No'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="totals">
            <div class="row">
              <div><span class="label">Total de Cajas:</span> ${totalBoxes}</div>
              <div><span class="label">Total Peso Neto:</span> ${totalNetWeight.toFixed(2)} kg</div>
            </div>
            <div class="row" style="margin-top: 3mm; font-size: 12pt;">
              <div><span class="label">TOTAL A PAGAR:</span> $${totalValue.toFixed(2)}</div>
            </div>
          </div>

          <div class="signature">
            <div class="signature-line"></div>
            <div>Firma del Encargado de Empaque</div>
          </div>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  // Download weighing as PDF
  const downloadWeighingPDF = (weighing) => {
    printLabel(weighing);
  };

  // Import orders from external app
  const importOrdersFromExternalApp = async () => {
    if (!externalApiUrl) {
      alert('Por favor ingresa la URL de la aplicación externa');
      return;
    }

    setImportLoading(true);
    try {
      // Fetch orders from external app
      const externalResponse = await fetch(`${externalApiUrl}/api/ordenes-entrada/sync`);
      
      if (!externalResponse.ok) {
        throw new Error(`Error al conectar con la aplicación externa: ${externalResponse.status}`);
      }

      const externalOrders = await externalResponse.json();

      if (!externalOrders || externalOrders.length === 0) {
        alert('No hay órdenes para importar en la aplicación externa');
        setImportLoading(false);
        return;
      }

      // Import orders to local database
      const importResponse = await fetch('/api/external-orders/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalApiUrl: externalApiUrl,
          orders: externalOrders
        })
      });

      const result = await importResponse.json();

      if (!importResponse.ok) {
        throw new Error(result.error || 'Error al importar órdenes');
      }

      setImportResult(result);
      
      if (result.successful > 0) {
        alert(`✓ Se importaron exitosamente ${result.successful} lotes de la aplicación externa.`);
        if (result.errors.length > 0) {
          alert(`⚠️ Hubo ${result.errors.length} error(es) durante la importación:\n\n${result.errors.join('\n')}`);
        }
      }

      setShowImportModal(false);
    } catch (error) {
      console.error('Error importing orders:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setImportLoading(false);
    }
  };

  // Download weighing as JPG
  const downloadWeighingJPG = (weighing) => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    
    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 800, 600);
    
    // Header
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('TECAVO FRUITS', 400, 60);
    
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(50, 80);
    ctx.lineTo(750, 80);
    ctx.stroke();
    
    // Info
    ctx.font = '24px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Lote: ${currentLot.lotNumber}`, 50, 140);
    ctx.fillText(`Productor: ${currentLot.producer}`, 50, 180);
    ctx.fillText(`Huerta: ${currentLot.orchardName}`, 50, 220);
    ctx.fillText(`Fecha: ${new Date(currentLot.date).toLocaleDateString('es-MX')}`, 50, 260);
    ctx.fillText(`Cajas: ${weighing.boxes}`, 50, 300);
    ctx.fillText(`Peso Bruto: ${weighing.gross_weight} kg`, 50, 340);
    ctx.fillText(`Tara: ${weighing.tare_weight} kg`, 50, 380);
    ctx.font = 'bold 28px Arial';
    ctx.fillText(`Peso Neto: ${weighing.net_weight} kg`, 50, 430);
    
    // Barcode simulation
    ctx.font = '40px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`*${currentLot.lotNumber}*`, 400, 520);
    
    // Download
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${currentLot.lotNumber}_pesada_${weighing.id}.jpg`;
      link.click();
      URL.revokeObjectURL(url);
    }, 'image/jpeg', 0.9);
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-gradient-to-br from-green-50 via-white to-blue-50">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass-panel border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2 text-green-700">
              <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center border border-green-500/20">
                <i className="ph-fill ph-plant text-green-600"></i>
              </div>
              <span className="font-bold text-lg tracking-tight">Tecavo Fruits Soft</span>
            </div>
            
            <nav className="hidden lg:flex items-center gap-1">
              <button onClick={() => router.push('/')} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium text-sm transition-colors">
                Dashboard Principal
              </button>
              <button className="px-4 py-2 rounded-lg bg-green-50 text-green-700 font-medium text-sm transition-colors cursor-default">
                Ingreso de Fruta
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-16 w-full">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          
          <section className="mb-8 flex items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Ingreso de Fruta</h1>
              <p className="text-slate-500 mt-1">Registra el ingreso de fruta con pesadas y fotografías</p>
              {/* Tipo de recepción - Fruta empacada support */}
              <div className="mt-2 inline-flex rounded-xl border text-sm overflow-hidden">
                <button type="button" onClick={() => {}} className="px-3 py-1 bg-emerald-700 text-white">Fruta de campo / a granel</button>
                <button type="button" onClick={() => alert('Ruta de fruta ya empacada: usa el módulo Reempaque para validación e ingreso de tarimas empacadas de terceros.')} className="px-3 py-1 hover:bg-slate-50">Fruta ya empacada</button>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/mobile-apps')}
                className="px-5 py-2.5 bg-purple-600 text-white font-medium rounded-xl hover:bg-purple-700 shadow-lg shadow-purple-500/25 transition-all flex items-center gap-2"
              >
                <i className="ph ph-qr-code text-lg"></i>
                Descargar App
              </button>
              
              <button
                onClick={() => router.push('/fruit-input/reporte')}
                className="px-5 py-2.5 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 shadow-lg shadow-green-500/25 transition-all flex items-center gap-2"
              >
                <i className="ph ph-chart-bar text-lg"></i>
                Generar Reporte
              </button>
              
              <button
                onClick={() => setShowImportModal(true)}
                className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2"
              >
                <i className="ph ph-import text-lg"></i>
                Importar de App Externa
              </button>
            </div>
          </section>

          {/* Accountant PIN generation now managed in independent /documentacion module for full traceability and document upload config */}

          {/* Import Modal */}
          {showImportModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <i className="ph ph-import text-blue-600 text-lg"></i>
                    Importar Órdenes
                  </h2>
                  <button
                    onClick={() => {
                      setShowImportModal(false);
                      setImportResult(null);
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600"
                  >
                    <i className="ph ph-x text-lg"></i>
                  </button>
                </div>

                {!importResult ? (
                  <>
                    <div className="space-y-4 mb-6">
                      <p className="text-sm text-slate-600">
                        Conecta con la aplicación externa para importar órdenes. Se mantendrán los números de lote originales.
                      </p>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">URL de la Aplicación Externa</label>
                        <input
                          type="text"
                          value={externalApiUrl}
                          onChange={(e) => setExternalApiUrl(e.target.value)}
                          placeholder="https://..."
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                        />
                        <p className="text-xs text-slate-500">
                          URL base de la aplicación (sin /api)
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowImportModal(false)}
                        className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-all"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={importOrdersFromExternalApp}
                        disabled={importLoading}
                        className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-all disabled:opacity-75 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {importLoading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            Importando...
                          </>
                        ) : (
                          <>
                            <i className="ph ph-download text-lg"></i>
                            Importar
                          </>
                        )}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-3 mb-6">
                      <div className="p-3 bg-green-50 border border-green-300 rounded-lg">
                        <p className="text-sm font-medium text-green-800">
                          ✓ {importResult.successful} de {importResult.total} lotes importados
                        </p>
                      </div>

                      {importResult.errors.length > 0 && (
                        <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg">
                          <p className="text-sm font-medium text-amber-800 mb-2">
                            ⚠️ {importResult.errors.length} error(es):
                          </p>
                          <ul className="text-xs text-amber-700 space-y-1">
                            {importResult.errors.map((error, i) => (
                              <li key={i}>• {error}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {importResult.imported.length > 0 && (
                        <div className="p-3 bg-blue-50 border border-blue-300 rounded-lg">
                          <p className="text-sm font-medium text-blue-800 mb-2">
                            Lotes importados:
                          </p>
                          <ul className="text-xs text-blue-700 space-y-1">
                            {importResult.imported.map((lot, i) => (
                              <li key={i}>• {lot.lot_number}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        setShowImportModal(false);
                        setImportResult(null);
                      }}
                      className="w-full px-4 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-all"
                    >
                      Cerrar
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Lot Information */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8">
            <h2 className="font-bold text-lg text-slate-900 mb-6 flex items-center gap-2">
              <i className="ph-fill ph-identification-card text-green-600"></i>
              Información del Lote
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* *** TRAZABILIDAD PERFECTA: Folio desde Orden de Corte (elegible al generar ingreso) *** */}
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-emerald-700 block">
                  Folio de Orden de Corte (Seleccionar para asignar lote al ingreso de fruta)
                </label>
                <select 
                  value={selectedCuttingFolio} 
                  onChange={handleSelectCuttingFolio}
                  disabled={lotCreated}
                  className="w-full px-4 py-2.5 rounded-xl border border-emerald-300 bg-white text-emerald-900 font-medium focus:border-emerald-600 outline-none"
                >
                  <option value="">— Sin folio asociado (asignar manualmente) —</option>
                  {cuttingOrders.map(o => (
                    <option key={o.id} value={o.folio}>
                      {o.folio} — {o.producer_name || 'Productor sin nombre'} — {o.cutting_date || ''} — Cajas:{o.boxes_count || 0}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-emerald-600">Al seleccionar el folio se asigna el lote desde la orden de corte • El lote sigue la trazabilidad.</p>
              </div>

              {/* INTEGRACIÓN CONTROL DE CAJAS: mostrar datos de la orden + registrar devolución (reutiliza /api/box-control sin duplicar) */}
              {selectedOrderDetails && (
                <div className="md:col-span-2 mt-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm">
                  <div className="font-medium text-emerald-800 mb-1">Control de Cajas (desde Orden de Corte)</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div>Cajas entregadas: <strong>{selectedOrderDetails.boxes_count || 0}</strong></div>
                    <div>Cuadrilla: <strong>{selectedOrderDetails.crew_chief_name || '-'}</strong></div>
                    <div>Transportista: <strong>{selectedOrderDetails.driver_name || '-'}</strong></div>
                    <div>Camión: <strong>{selectedOrderDetails.truck_plates || '-'}</strong></div>
                  </div>
                  <button 
                    onClick={async () => {
                      if (!selectedCuttingOrderId) return;
                      try {
                        await fetch('/api/box-control', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            action: 'devolucion_cajas',
                            cutting_order_id: selectedCuttingOrderId,
                            lot_id: lotId,
                            boxes_quantity: parseInt(selectedOrderDetails.boxes_count || 0),
                            responsible_name: currentLot.producer || 'Operaciones',
                            notes: `Devolución registrada desde Ingreso de Fruta - Lote ${currentLot.lotNumber}`
                          })
                        });
                        alert('✓ Devolución de cajas registrada en Control de Cajas (sin duplicados)');
                      } catch (e) { alert('No se pudo registrar devolución'); }
                    }}
                    className="mt-2 px-3 py-1 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-700"
                  >
                    Registrar devolución de cajas en Control de Cajas
                  </button>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Número de Lote (Automático - Formato: TCV-FTS-0001)</label>
                <input 
                  type="text" 
                  value={currentLot.lotNumber}
                  disabled
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 font-mono font-bold text-lg" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Fecha</label>
                <input 
                  type="date" 
                  value={currentLot.date}
                  disabled
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-600" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Nombre del Productor *</label>
                <input 
                  type="text" 
                  value={currentLot.producer}
                  onChange={(e) => setCurrentLot({ ...currentLot, producer: e.target.value })}
                  placeholder="Ej. Juan Pérez"
                  disabled={lotCreated}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none disabled:bg-slate-50 disabled:text-slate-600" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Nombre de la Huerta *</label>
                <input 
                  type="text" 
                  value={currentLot.orchardName}
                  onChange={(e) => setCurrentLot({ ...currentLot, orchardName: e.target.value })}
                  placeholder="Ej. La Esperanza"
                  disabled={lotCreated}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none disabled:bg-slate-50 disabled:text-slate-600" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Municipio *</label>
                <input 
                  type="text" 
                  value={currentLot.municipality}
                  onChange={(e) => setCurrentLot({ ...currentLot, municipality: e.target.value })}
                  placeholder="Ej. Uruapan"
                  disabled={lotCreated}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none disabled:bg-slate-50 disabled:text-slate-600" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Registro de Huerta</label>
                <input 
                  type="text" 
                  value={currentLot.orchardRegistry || ''}
                  onChange={(e) => setCurrentLot({ ...currentLot, orchardRegistry: e.target.value })}
                  placeholder="Ej. REG-HU-12345"
                  disabled={lotCreated}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none disabled:bg-slate-50 disabled:text-slate-600" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Folio de Guía</label>
                <input 
                  type="text" 
                  value={currentLot.guideFolio || ''}
                  onChange={(e) => setCurrentLot({ ...currentLot, guideFolio: e.target.value })}
                  placeholder="Ej. GUI-2025-001"
                  disabled={lotCreated}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none disabled:bg-slate-50 disabled:text-slate-600" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Nombre del Corredor / Broker *</label>
                <input 
                  type="text" 
                  value={currentLot.collectorName || currentLot.brokerName || ''}
                  onChange={(e) => setCurrentLot({ ...currentLot, collectorName: e.target.value, brokerName: e.target.value })}
                  placeholder="Nombre del corredor"
                  disabled={lotCreated}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none disabled:bg-slate-50 disabled:text-slate-600" 
                />
              </div>
            </div>

            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <h3 className="font-semibold text-amber-900 mb-4 flex items-center gap-2">
                <i className="ph ph-coins text-amber-600"></i>
                Datos adicionales de la fruta
              </h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={currentLot.isCuttingFruit || false}
                    onChange={(e) => setCurrentLot({ ...currentLot, isCuttingFruit: e.target.checked })}
                    disabled={lotCreated}
                    className="w-5 h-5 rounded border-slate-300 text-amber-600 focus:ring-2 focus:ring-amber-500/20 disabled:opacity-50" 
                  />
                  <span className="text-sm font-medium text-slate-700">Fruta de corte</span>
                </label>
                
                <label className="flex items-center gap-3 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={currentLot.isPackingHouse || false}
                    onChange={(e) => setCurrentLot({ ...currentLot, isPackingHouse: e.target.checked })}
                    disabled={lotCreated}
                    className="w-5 h-5 rounded border-slate-300 text-amber-600 focus:ring-2 focus:ring-amber-500/20 disabled:opacity-50" 
                  />
                  <span className="text-sm font-medium text-slate-700">Fruta puesta en empaque</span>
                </label>
                
                <label className="flex items-center gap-3 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={currentLot.freightPaid || false}
                    onChange={(e) => setCurrentLot({ ...currentLot, freightPaid: e.target.checked })}
                    disabled={lotCreated}
                    className="w-5 h-5 rounded border-slate-300 text-amber-600 focus:ring-2 focus:ring-amber-500/20 disabled:opacity-50" 
                  />
                  <span className="text-sm font-medium text-slate-700">Flete pagado</span>
                </label>
                
                <label className="flex items-center gap-3 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={currentLot.crewPaid || false}
                    onChange={(e) => setCurrentLot({ ...currentLot, crewPaid: e.target.checked })}
                    disabled={lotCreated}
                    className="w-5 h-5 rounded border-slate-300 text-amber-600 focus:ring-2 focus:ring-amber-500/20 disabled:opacity-50" 
                  />
                  <span className="text-sm font-medium text-slate-700">Cuadrilla pagada</span>
                </label>
              </div>
            </div>

            {!lotCreated && (
              <div className="mt-6">
                <button 
                  onClick={createLot}
                  className="px-6 py-3 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 shadow-sm transition-all"
                >
                  Crear Lote y Continuar con Pesadas
                </button>
              </div>
            )}

            {lotCreated && (
              <div className="mt-6 flex gap-3 flex-wrap">
                <button 
                  onClick={async () => {
                    try {
                      const response = await fetch(`/api/lots/${lotId}/contract`);
                      if (!response.ok) throw new Error('Error al generar contrato');
                      
                      const blob = await response.blob();
                      const url = window.URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `Contrato_${currentLot.lotNumber}.pdf`;
                      link.click();
                      window.URL.revokeObjectURL(url);
                      
                      alert('✓ Contrato generado exitosamente');
                    } catch (error) {
                      console.error('Error downloading contract:', error);
                      alert('Error al generar el contrato. Por favor intenta nuevamente.');
                    }
                  }}
                  className="px-6 py-3 bg-purple-600 text-white font-medium rounded-xl hover:bg-purple-700 shadow-sm transition-all flex items-center gap-2"
                >
                  <i className="ph ph-file-pdf text-lg"></i>
                  Descargar Contrato
                </button>

                <button 
                  onClick={() => router.push('/documentacion')}
                  className="px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 shadow-sm transition-all flex items-center gap-2"
                >
                    <i className="ph ph-file-text text-lg"></i>
                    Gestionar en Módulo Documentación (PIN + Subida Docs)
                </button>
              </div>
            )}
          </div>

          {/* Weighings Section */}
          {lotCreated && (
            <>
              {/* Public Scale Weighing Section */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8">
                <h2 className="font-bold text-lg text-slate-900 mb-6 flex items-center gap-2">
                  <i className="ph-fill ph-scale text-orange-600"></i>
                  Báscula Pública - Total de Kilos Pesados en Entrada
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Total de Kilos Pesados *</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={totalKgPublicScale}
                      onChange={(e) => setTotalKgPublicScale(e.target.value)}
                      placeholder="Ej. 1200.50"
                      disabled={savedPublicScale}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none disabled:bg-slate-50 disabled:text-slate-600" 
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Fecha de Pesada</label>
                    <input 
                      type="date" 
                      value={publicScaleDate}
                      onChange={(e) => setPublicScaleDate(e.target.value)}
                      disabled={savedPublicScale}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none disabled:bg-slate-50 disabled:text-slate-600" 
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Notas</label>
                    <input 
                      type="text" 
                      value={publicScaleNotes}
                      onChange={(e) => setPublicScaleNotes(e.target.value)}
                      placeholder="Ej. Pesada en balanza #2"
                      disabled={savedPublicScale}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none disabled:bg-slate-50 disabled:text-slate-600" 
                    />
                  </div>
                </div>

                {!savedPublicScale ? (
                  <button 
                    onClick={savePublicScaleWeighing}
                    className="px-6 py-3 bg-orange-600 text-white font-medium rounded-xl hover:bg-orange-700 shadow-sm transition-all flex items-center gap-2"
                  >
                    <i className="ph ph-check-circle text-lg"></i>
                    Guardar Total de Kilos
                  </button>
                ) : (
                  <div className="p-3 bg-green-100 border border-green-300 rounded-lg text-green-800 text-sm flex items-center gap-2">
                    <i className="ph ph-check-circle text-lg"></i>
                    <span>
                      <strong>Total de kilos guardado:</strong> {totalKgPublicScale} kg
                    </span>
                  </div>
                )}
              </div>

              {/* New Weighing Form */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8">
                <h2 className="font-bold text-lg text-slate-900 mb-6 flex items-center gap-2">
                  <i className="ph-fill ph-scales text-green-600"></i>
                  Nueva Pesada
                </h2>

                {/* Scale Device Controls */}
                {scaleDevices.length > 0 && (
                  <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                      <i className="ph ph-scale text-blue-600"></i>
                      Sincronización de Escala Externa
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Seleccionar Escala</label>
                        <select
                          value={selectedScaleDevice?.id || ''}
                          onChange={(e) => {
                            const device = scaleDevices.find(d => d.id === parseInt(e.target.value));
                            setSelectedScaleDevice(device);
                          }}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        >
                          <option value="">-- Selecciona una escala --</option>
                          {scaleDevices.map((device) => (
                            <option key={device.id} value={device.id}>
                              {device.device_name} ({device.connection_type})
                            </option>
                          ))}
                        </select>
                      </div>

                      {selectedScaleDevice && (
                        <>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Estado de Conexión</label>
                            <div className="px-4 py-2.5 rounded-xl border border-slate-200 flex items-center gap-2 text-sm">
                              <span className={`w-2.5 h-2.5 rounded-full ${
                                isConnected ? 'bg-emerald-500' : connectionStatus === 'connecting' ? 'bg-amber-500 animate-pulse' : 'bg-slate-300'
                              }`}></span>
                              <span className="text-slate-600 font-medium">
                                {isConnected ? 'Conectada' : connectionStatus === 'connecting' ? 'Conectando...' : 'Desconectada'}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Acciones</label>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  if (!useScaleSync) {
                                    setUseScaleSync(true);
                                    connect();
                                  } else {
                                    setUseScaleSync(false);
                                    disconnect();
                                  }
                                }}
                                className={`flex-1 px-4 py-2.5 font-medium rounded-xl transition-all flex items-center justify-center gap-2 text-sm ${
                                  useScaleSync
                                    ? 'bg-red-600 hover:bg-red-700 text-white'
                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                                }`}
                              >
                                {useScaleSync ? (
                                  <>
                                    <i className="ph ph-plug-x"></i>
                                    Desconectar
                                  </>
                                ) : (
                                  <>
                                    <i className="ph ph-plug"></i>
                                    Conectar
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    {useScaleSync && weight && (
                      <div className="mt-3 p-3 bg-emerald-100 border border-emerald-300 rounded-lg text-emerald-800 text-sm flex items-center gap-2">
                        <i className="ph ph-check-circle text-lg"></i>
                        <span>
                          <strong>Peso detectado:</strong> {weight.toFixed(2)} kg
                          <br/>
                          <span className="text-xs opacity-75">Se completará automáticamente en el campo de peso bruto</span>
                        </span>
                      </div>
                    )}
                    {useScaleSync && !weight && (
                      <div className="mt-3 p-3 bg-amber-100 border border-amber-300 rounded-lg text-amber-800 text-sm flex items-center gap-2">
                        <i className="ph ph-warning-circle text-lg"></i>
                        <span>Esperando lectura de la escala... Coloca el objeto en la balanza</span>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Número de Cajas *</label>
                    <input 
                      type="number" 
                      value={currentWeighing.boxes}
                      onChange={(e) => setCurrentWeighing({ ...currentWeighing, boxes: e.target.value })}
                      placeholder="Ej. 50"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none" 
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Peso Bruto (kg) *</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={currentWeighing.grossWeight}
                      onChange={(e) => setCurrentWeighing({ ...currentWeighing, grossWeight: e.target.value })}
                      placeholder="Ej. 1050.50"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none" 
                    />
                  </div>
                </div>

                {/* Real-time Weight Display Panel */}
                {useScaleSync && selectedScaleDevice && (
                  <div className="mb-6 p-4 bg-gradient-to-br from-emerald-50 to-blue-50 border-2 border-emerald-300 rounded-xl">
                    <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                      <i className="ph-fill ph-gauge text-emerald-600 text-lg"></i>
                      Panel de Lectura en Tiempo Real
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Current Weight Display */}
                      <div className="bg-white rounded-lg border-2 border-emerald-300 p-4">
                        <div className="text-sm text-slate-600 font-medium mb-2">Peso Actual Detectado</div>
                        <div className="text-4xl font-bold text-emerald-600 font-mono">
                          {weight ? weight.toFixed(2) : '---'}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">kg</div>
                        {lastUpdateTime && (
                          <div className="text-xs text-slate-400 mt-2">
                            Actualizado: {lastUpdateTime.toLocaleTimeString('es-MX')}
                          </div>
                        )}
                      </div>

                      {/* Weight Statistics */}
                      <div className="bg-white rounded-lg border-2 border-blue-300 p-4">
                        <div className="text-sm text-slate-600 font-medium mb-2">Estadísticas de Lectura</div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Máximo:</span>
                            <span className="font-mono font-bold text-slate-900">
                              {weightHistory.length > 0 
                                ? Math.max(...weightHistory.map(w => w.value)).toFixed(2)
                                : '---'
                              }
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Mínimo:</span>
                            <span className="font-mono font-bold text-slate-900">
                              {weightHistory.length > 0 
                                ? Math.min(...weightHistory.map(w => w.value)).toFixed(2)
                                : '---'
                              }
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Promedio:</span>
                            <span className="font-mono font-bold text-slate-900">
                              {weightHistory.length > 0 
                                ? (weightHistory.reduce((sum, w) => sum + w.value, 0) / weightHistory.length).toFixed(2)
                                : '---'
                              }
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Lecturas:</span>
                            <span className="font-mono font-bold text-slate-900">{weightHistory.length}</span>
                          </div>
                        </div>
                      </div>

                      {/* Weight History Chart */}
                      <div className="bg-white rounded-lg border-2 border-purple-300 p-4">
                        <div className="text-sm text-slate-600 font-medium mb-3">Historial (últimas 20 lecturas)</div>
                        <svg width="100%" height="80" className="border border-slate-200 rounded-lg bg-slate-50">
                          {weightHistory.length > 1 && (
                            <polyline
                              points={weightHistory.map((w, i) => {
                                const x = (i / (weightHistory.length - 1)) * 100 + '%';
                                const maxWeight = Math.max(...weightHistory.map(h => h.value));
                                const minWeight = Math.min(...weightHistory.map(h => h.value));
                                const range = maxWeight - minWeight || 1;
                                const y = ((maxWeight - w.value) / range) * 70 + 5;
                                return `${x} ${y}%`;
                              }).join(' ')}
                              fill="none"
                              stroke="#10b981"
                              strokeWidth="2"
                              vectorEffect="non-scaling-stroke"
                            />
                          )}
                          {weightHistory.map((w, i) => {
                            const x = (i / (weightHistory.length - 1)) * 100 + '%';
                            const maxWeight = Math.max(...weightHistory.map(h => h.value));
                            const minWeight = Math.min(...weightHistory.map(h => h.value));
                            const range = maxWeight - minWeight || 1;
                            const y = ((maxWeight - w.value) / range) * 70 + 5;
                            return (
                              <circle
                                key={i}
                                cx={x}
                                cy={y + '%'}
                                r="3"
                                fill={i === weightHistory.length - 1 ? '#059669' : '#10b981'}
                                opacity={i === weightHistory.length - 1 ? 1 : 0.6}
                              />
                            );
                          })}
                        </svg>
                        <div className="text-xs text-slate-500 mt-2 text-center">Tendencia en tiempo real</div>
                      </div>
                    </div>

                    {/* Status Indicator */}
                    <div className="mt-4 p-3 bg-emerald-100 border border-emerald-300 rounded-lg flex items-center gap-2 text-sm text-emerald-800">
                      <i className="ph-fill ph-circle text-emerald-600 animate-pulse"></i>
                      <span>
                        <strong>Escala conectada:</strong> {selectedScaleDevice.device_name}
                        {lastUpdateTime && (
                          <span className="text-xs opacity-75 ml-2">
                            (Último dato hace {Math.round((Date.now() - lastUpdateTime) / 1000)} segundos)
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                )}

                <div className="md:col-span-2 flex items-center gap-3 mb-6">
                  <input 
                    type="checkbox"
                    id="withPallet"
                    checked={currentWeighing.withPallet}
                    onChange={(e) => setCurrentWeighing({ ...currentWeighing, withPallet: e.target.checked })}
                    className="w-5 h-5 rounded border-slate-300 text-green-600 focus:ring-2 focus:ring-green-500/20" 
                  />
                  <label htmlFor="withPallet" className="text-sm font-medium text-slate-700 cursor-pointer">
                    ¿Incluye tarima? (22 kg adicionales de tara)
                  </label>
                </div>

                {/* Photo Section - FASE 05: DOS BOTONES INDEPENDIENTES */}
                <div className="space-y-4">
                  <label className="text-sm font-medium text-slate-700">Evidencias de Pesada (dos botones independientes)</label>
                  
                  {/* Botón 1: Guía de Campo */}
                  <div className="border rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium">1. Foto Guía de Campo</div>
                      {!currentWeighing.guiaCampoPreview && (
                        <button onClick={() => startCameraFor('guia')} className="text-xs px-3 py-1 bg-blue-600 text-white rounded">Tomar / Subir</button>
                      )}
                    </div>
                    {currentWeighing.guiaCampoPreview && (
                      <div className="relative">
                        <img src={currentWeighing.guiaCampoPreview} alt="Guía Campo" className="w-full max-h-40 object-contain rounded border" style={{transform: `rotate(${rotGuia}deg)`}} />
                        <div className="absolute top-1 left-1 flex gap-1">
                          <button onClick={() => setRotGuia(r => r - 90)} className="bg-white/80 text-xs px-1 rounded">↺</button>
                          <button onClick={() => setRotGuia(r => r + 90)} className="bg-white/80 text-xs px-1 rounded">↻</button>
                        </div>
                        <button onClick={() => { setCurrentWeighing(p => ({...p, guiaCampoPhoto:null, guiaCampoPreview:null})); setRotGuia(0); }} className="absolute top-1 right-1 bg-red-500 text-white rounded-full px-1 text-xs">×</button>
                      </div>
                    )}
                  </div>

                  {/* Botón 2: Boleta de Báscula */}
                  <div className="border rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium">2. Foto Boleta de Báscula</div>
                      {!currentWeighing.boletaBasculaPreview && (
                        <button onClick={() => startCameraFor('boleta')} className="text-xs px-3 py-1 bg-blue-600 text-white rounded">Tomar / Subir</button>
                      )}
                    </div>
                    {currentWeighing.boletaBasculaPreview && (
                      <div className="relative">
                        <img src={currentWeighing.boletaBasculaPreview} alt="Boleta" className="w-full max-h-40 object-contain rounded border" style={{transform: `rotate(${rotBoleta}deg)`}} />
                        <div className="absolute top-1 left-1 flex gap-1">
                          <button onClick={() => setRotBoleta(r => r - 90)} className="bg-white/80 text-xs px-1 rounded">↺</button>
                          <button onClick={() => setRotBoleta(r => r + 90)} className="bg-white/80 text-xs px-1 rounded">↻</button>
                        </div>
                        <button onClick={() => { setCurrentWeighing(p => ({...p, boletaBasculaPhoto:null, boletaBasculaPreview:null})); setRotBoleta(0); }} className="absolute top-1 right-1 bg-red-500 text-white rounded-full px-1 text-xs">×</button>
                      </div>
                    )}
                  </div>

                  {/* Botón CAPTURAR PESADA DESDE BÁSCULA (valida estable) */}
                  {useScaleSync && selectedScaleDevice && (
                    <button 
                      onClick={captureStableFromScale}
                      className="w-full py-2 bg-emerald-700 text-white rounded-xl text-sm flex items-center justify-center gap-2"
                    >
                      <i className="ph ph-scale"></i> CAPTURAR PESADA DESDE BÁSCULA (validar estable)
                    </button>
                  )}

                  {/* Legacy single photo (kept for compatibility) */}
                  {!currentWeighing.photoPreview && !showCamera && (
                    <div className="flex gap-3">
                      <button onClick={startCamera} className="flex-1 px-4 py-2 bg-slate-600 text-white text-xs rounded">Tomar Foto Adicional</button>
                      <button onClick={() => fileInputRef.current?.click()} className="flex-1 px-4 py-2 bg-slate-600 text-white text-xs rounded">Subir Foto Adicional</button>
                    </div>
                  )}

                  {showCamera && (
                    <div className="relative">
                      <video 
                        ref={videoRef}
                        autoPlay 
                        playsInline
                        className="w-full rounded-xl border-2 border-slate-300"
                      />
                      <canvas 
                        ref={canvasRef}
                        style={{ display: 'none' }}
                      />
                      <div className="mt-3 flex gap-3">
                        <button 
                          onClick={cameraTarget ? capturePhotoForTarget : capturePhoto}
                          className="flex-1 px-6 py-3 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 shadow-sm transition-all flex items-center justify-center gap-2"
                        >
                          <i className="ph ph-camera text-lg"></i>
                          Capturar
                        </button>
                        <button 
                          onClick={stopCamera}
                          className="px-6 py-3 bg-slate-600 text-white font-medium rounded-xl hover:bg-slate-700 shadow-sm transition-all"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {currentWeighing.photoPreview && (
                    <div className="relative">
                      <img 
                        src={currentWeighing.photoPreview} 
                        alt="Preview" 
                        className="w-full max-w-md rounded-xl border-2 border-green-500" 
                      />
                      <button 
                        onClick={() => setCurrentWeighing({ ...currentWeighing, photo: null, photoPreview: null })}
                        className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-lg transition-colors"
                      >
                        <i className="ph ph-x text-lg"></i>
                      </button>
                    </div>
                  )}

                  <input 
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                </div>

                <div className="mt-6">
                  <button 
                    onClick={addWeighing}
                    className="px-6 py-3 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 shadow-lg shadow-green-500/25 transition-all flex items-center gap-2"
                  >
                    <i className="ph ph-plus-circle text-lg"></i>
                    Agregar Pesada
                  </button>
                </div>
              </div>

              {/* Weighings List */}
              {weighings.length > 0 && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h2 className="font-bold text-lg text-slate-900 mb-6 flex items-center gap-2">
                    <i className="ph-fill ph-list-checks text-green-600"></i>
                    Pesadas Registradas ({weighings.length})
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {weighings.map((weighing, index) => (
                      <div key={weighing.id || index} className="border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                          <div className="font-bold text-slate-900">Pesada #{index + 1}</div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => printLabel(weighing)}
                              className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                              title="Imprimir etiqueta"
                            >
                              <i className="ph ph-printer text-sm"></i>
                            </button>
                            <button 
                              onClick={() => downloadWeighingJPG(weighing)}
                              className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
                              title="Descargar JPG"
                            >
                              <i className="ph ph-image text-sm"></i>
                            </button>
                          </div>
                        </div>
                        
                        {weighing.photoPreview && (
                          <img 
                            src={weighing.photoPreview} 
                            alt={`Pesada ${index + 1}`} 
                            className="w-full h-32 object-cover rounded-lg mb-3" 
                          />
                        )}
                        
                        <div className="text-sm text-slate-600 space-y-1">
                          <div className="flex justify-between">
                            <span className="font-medium">Cajas:</span>
                            <span>{weighing.boxes}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium">Peso Bruto:</span>
                            <span>{weighing.gross_weight} kg</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium">Tara:</span>
                            <span>{weighing.tare_weight} kg</span>
                          </div>
                          <div className="flex justify-between font-bold text-green-600">
                            <span>Peso Neto:</span>
                            <span>{weighing.net_weight} kg</span>
                          </div>
                          {weighing.with_pallet && (
                            <div className="text-xs text-blue-600 mt-2">
                              <i className="ph ph-check-circle mr-1"></i>
                              Con tarima
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-6 p-4 bg-green-50 rounded-xl border border-green-200">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      <div>
                        <div className="text-sm text-slate-600">Total Cajas</div>
                        <div className="text-2xl font-bold text-slate-900">
                          {weighings.reduce((sum, w) => sum + parseInt(w.boxes), 0)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-slate-600">Total Peso Bruto</div>
                        <div className="text-2xl font-bold text-slate-900">
                          {weighings.reduce((sum, w) => sum + parseFloat(w.gross_weight), 0).toFixed(2)} kg
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-slate-600">Total Peso Neto</div>
                        <div className="text-2xl font-bold text-green-600">
                          {weighings.reduce((sum, w) => sum + parseFloat(w.net_weight), 0).toFixed(2)} kg
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-slate-600">Valor Total</div>
                        <div className="text-2xl font-bold text-green-600">
                          ${(weighings.reduce((sum, w) => sum + parseFloat(w.net_weight), 0) * parseFloat(currentLot.fruitPrice)).toFixed(2)}
                        </div>
                      </div>
                    </div>
                    {/* Mostrar trazabilidad origen */}
                    {selectedCuttingFolio && (
                      <div className="mt-4 text-center text-xs bg-emerald-50 border border-emerald-200 p-2 rounded">
                        Lote trazado desde Folio Orden de Corte: <strong className="font-mono">{selectedCuttingFolio}</strong>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-6 flex gap-3">
                    <button 
                      onClick={printIntakeNote}
                      className="flex-1 px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 shadow-sm transition-all flex items-center justify-center gap-2"
                    >
                      <i className="ph ph-printer text-lg"></i>
                      Imprimir Nota de Ingreso (2 copias)
                    </button>
                    <button 
                      onClick={() => {
                        if (confirm('¿Finalizar el lote actual y empezar uno nuevo?')) {
                          window.location.reload();
                        }
                      }}
                      className="px-6 py-3 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 shadow-sm transition-all flex items-center justify-center gap-2"
                    >
                      <i className="ph ph-check-circle text-lg"></i>
                      Finalizar Lote
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

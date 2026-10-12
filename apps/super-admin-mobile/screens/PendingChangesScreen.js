import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';

const API_URL = 'https://i6czgxeubs1sxilogt8if.web-preview.appgen.com';

export default function PendingChangesScreen() {
  const [changes, setChanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadPendingChanges();
  }, []);

  const loadPendingChanges = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/pending-changes?status=pending`);
      const data = await response.json();
      setChanges(data);
    } catch (error) {
      console.error('Error loading pending changes:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleApprove = async (changeId) => {
    Alert.alert(
      'Aprobar Cambio',
      '¿Estás seguro de aprobar este cambio?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aprobar',
          onPress: async () => {
            try {
              await fetch(`${API_URL}/api/pending-changes`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: changeId,
                  status: 'approved',
                  reviewedBy: 'super-admin-user-id',
                }),
              });
              
              Alert.alert('Éxito', 'Cambio aprobado correctamente');
              loadPendingChanges();
            } catch (error) {
              Alert.alert('Error', 'No se pudo aprobar el cambio');
            }
          },
        },
      ]
    );
  };

  const handleReject = async (changeId) => {
    Alert.alert(
      'Rechazar Cambio',
      '¿Estás seguro de rechazar este cambio?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Rechazar',
          style: 'destructive',
          onPress: async () => {
            try {
              await fetch(`${API_URL}/api/pending-changes`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: changeId,
                  status: 'rejected',
                  reviewedBy: 'super-admin-user-id',
                }),
              });
              
              Alert.alert('Cambio rechazado');
              loadPendingChanges();
            } catch (error) {
              Alert.alert('Error', 'No se pudo rechazar el cambio');
            }
          },
        },
      ]
    );
  };

  const renderChange = ({ item }) => (
    <View style={styles.changeCard}>
      <View style={styles.changeHeader}>
        <Text style={styles.changeModule}>{item.module}</Text>
        <Text style={styles.changeType}>{item.change_type}</Text>
      </View>
      
      <Text style={styles.changeTable}>Tabla: {item.table_name}</Text>
      
      <View style={styles.changeInfo}>
        <Text style={styles.changeLabel}>Solicitado por:</Text>
        <Text style={styles.changeValue}>{item.requested_by_name || 'Usuario'}</Text>
      </View>
      
      <View style={styles.changeInfo}>
        <Text style={styles.changeLabel}>Fecha:</Text>
        <Text style={styles.changeValue}>
          {new Date(item.requested_at).toLocaleString('es-MX')}
        </Text>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.button, styles.approveButton]}
          onPress={() => handleApprove(item.id)}
        >
          <Text style={styles.buttonText}>✅ Aprobar</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, styles.rejectButton]}
          onPress={() => handleReject(item.id)}
        >
          <Text style={styles.buttonText}>❌ Rechazar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1e40af" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={changes}
        renderItem={renderChange}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadPendingChanges} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyText}>No hay cambios pendientes</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  listContainer: {
    padding: 15,
  },
  changeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  changeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  changeModule: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  changeType: {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '600',
  },
  changeTable: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 10,
  },
  changeInfo: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  changeLabel: {
    fontSize: 14,
    color: '#9ca3af',
    width: 120,
  },
  changeValue: {
    fontSize: 14,
    color: '#1f2937',
    flex: 1,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 15,
    gap: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  approveButton: {
    backgroundColor: '#10b981',
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 15,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
  },
});

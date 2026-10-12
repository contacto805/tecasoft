import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';

const API_URL = 'https://i6czgxeubs1sxilogt8if.web-preview.appgen.com';

export default function DashboardScreen() {
  const [stats, setStats] = useState({
    pendingChanges: 0,
    unreadNotifications: 0,
    todayLotifications: 0,
    todayLoads: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      
      // Get pending changes count
      const changesRes = await fetch(`${API_URL}/api/pending-changes?status=pending`);
      const changes = await changesRes.json();
      
      // Get unread notifications count
      const notifRes = await fetch(`${API_URL}/api/notifications?userId=super-admin-user-id&unreadOnly=true`);
      const notifications = await notifRes.json();
      
      setStats({
        pendingChanges: changes.length || 0,
        unreadNotifications: notifications.length || 0,
        todayLotifications: 0,
        todayLoads: 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadStats();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1e40af" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>Hola, Super Admin 👋</Text>
        <Text style={styles.subtitle}>Panel de control principal</Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={[styles.statCard, styles.pendingCard]}>
          <Text style={styles.statNumber}>{stats.pendingChanges}</Text>
          <Text style={styles.statLabel}>Cambios Pendientes</Text>
          <Text style={styles.statIcon}>⏳</Text>
        </View>

        <View style={[styles.statCard, styles.notificationCard]}>
          <Text style={styles.statNumber}>{stats.unreadNotifications}</Text>
          <Text style={styles.statLabel}>Notificaciones</Text>
          <Text style={styles.statIcon}>🔔</Text>
        </View>

        <View style={[styles.statCard, styles.lotificationCard]}>
          <Text style={styles.statNumber}>{stats.todayLotifications}</Text>
          <Text style={styles.statLabel}>Lotificaciones Hoy</Text>
          <Text style={styles.statIcon}>📊</Text>
        </View>

        <View style={[styles.statCard, styles.loadsCard]}>
          <Text style={styles.statNumber}>{stats.todayLoads}</Text>
          <Text style={styles.statLabel}>Cargas Hoy</Text>
          <Text style={styles.statIcon}>🚚</Text>
        </View>
      </View>

      <View style={styles.quickActions}>
        <Text style={styles.sectionTitle}>Acciones Rápidas</Text>
        
        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionIcon}>👥</Text>
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>Usuarios</Text>
            <Text style={styles.actionSubtitle}>Gestionar usuarios del sistema</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionIcon}>📋</Text>
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>Reportes</Text>
            <Text style={styles.actionSubtitle}>Ver reportes y estadísticas</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionIcon}>⚙️</Text>
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>Configuración</Text>
            <Text style={styles.actionSubtitle}>Ajustes del sistema</Text>
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
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
  header: {
    backgroundColor: '#1e40af',
    padding: 20,
    paddingTop: 10,
    paddingBottom: 30,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#93c5fd',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 15,
    marginTop: -20,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    marginHorizontal: '1%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pendingCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  notificationCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  lotificationCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  loadsCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#8b5cf6',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  statIcon: {
    position: 'absolute',
    top: 15,
    right: 15,
    fontSize: 30,
    opacity: 0.3,
  },
  quickActions: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 15,
  },
  actionButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  actionIcon: {
    fontSize: 40,
    marginRight: 15,
  },
  actionText: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 13,
    color: '#6b7280',
  },
});

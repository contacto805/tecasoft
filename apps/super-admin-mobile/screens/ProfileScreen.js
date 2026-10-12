import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';

export default function ProfileScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>SA</Text>
        </View>
        <Text style={styles.userName}>Super Administrador</Text>
        <Text style={styles.userEmail}>admin@empresa.com</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Acceso Total</Text>
        
        <View style={styles.permissionCard}>
          <Text style={styles.permissionIcon}>✅</Text>
          <View style={styles.permissionText}>
            <Text style={styles.permissionTitle}>Todos los Módulos</Text>
            <Text style={styles.permissionDescription}>
              Acceso completo a todos los módulos del sistema
            </Text>
          </View>
        </View>

        <View style={styles.permissionCard}>
          <Text style={styles.permissionIcon}>✅</Text>
          <View style={styles.permissionText}>
            <Text style={styles.permissionTitle}>Gestión de Usuarios</Text>
            <Text style={styles.permissionDescription}>
              Crear, editar y eliminar usuarios
            </Text>
          </View>
        </View>

        <View style={styles.permissionCard}>
          <Text style={styles.permissionIcon}>✅</Text>
          <View style={styles.permissionText}>
            <Text style={styles.permissionTitle}>Aprobación de Cambios</Text>
            <Text style={styles.permissionDescription}>
              Aprobar o rechazar cambios en el sistema
            </Text>
          </View>
        </View>

        <View style={styles.permissionCard}>
          <Text style={styles.permissionIcon}>✅</Text>
          <View style={styles.permissionText}>
            <Text style={styles.permissionTitle}>Reportes Avanzados</Text>
            <Text style={styles.permissionDescription}>
              Acceso a todos los reportes y estadísticas
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Configuración</Text>
        
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuIcon}>🔔</Text>
          <Text style={styles.menuText}>Notificaciones</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuIcon}>🔒</Text>
          <Text style={styles.menuText}>Cambiar Contraseña</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuIcon}>ℹ️</Text>
          <Text style={styles.menuText}>Acerca de</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton}>
        <Text style={styles.logoutText}>Cerrar Sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  profileHeader: {
    backgroundColor: '#1e40af',
    padding: 30,
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  userEmail: {
    fontSize: 14,
    color: '#93c5fd',
  },
  section: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 10,
  },
  permissionCard: {
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
  permissionIcon: {
    fontSize: 30,
    marginRight: 15,
  },
  permissionText: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  permissionDescription: {
    fontSize: 13,
    color: '#6b7280',
  },
  menuItem: {
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
  menuIcon: {
    fontSize: 24,
    marginRight: 15,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
  },
  menuArrow: {
    fontSize: 24,
    color: '#9ca3af',
  },
  logoutButton: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    padding: 15,
    margin: 15,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

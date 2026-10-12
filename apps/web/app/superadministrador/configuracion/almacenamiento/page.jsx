'use client';

import { useState, useEffect } from 'react';

export default function StorageManagement() {
  const [migrationStatus, setMigrationStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);

  useEffect(() => {
    fetchMigrationStatus();
  }, []);

  const fetchMigrationStatus = async () => {
    try {
      const response = await fetch('/api/payment-documents/migrate-gdrive');
      const data = await response.json();
      setMigrationStatus(data);
    } catch (error) {
      console.error('Error fetching migration status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMigrate = async () => {
    if (!confirm('¿Desea migrar todos los documentos de Google Drive al almacenamiento interno?\n\nEsta operación puede tardar varios minutos dependiendo de la cantidad de documentos.')) {
      return;
    }

    setMigrating(true);

    try {
      const response = await fetch('/api/payment-documents/migrate-gdrive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'admin',
          userName: 'Superadministrador'
        })
      });

      const result = await response.json();

      if (result.success) {
        alert(result.message);
        fetchMigrationStatus();
      } else {
        alert('Error: ' + result.error);
      }
    } catch (error) {
      console.error('Error during migration:', error);
      alert('Error al migrar documentos');
    } finally {
      setMigrating(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Gestión de Almacenamiento de Documentos</h1>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Información del Sistema</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded">
            <div className="text-sm text-gray-600">Almacenamiento Actual</div>
            <div className="text-2xl font-bold text-blue-600">Interno</div>
            <div className="text-xs text-gray-500 mt-1">Sistema de archivos local</div>
          </div>

          <div className="bg-green-50 p-4 rounded">
            <div className="text-sm text-gray-600">Documentos Migrados</div>
            <div className="text-2xl font-bold text-green-600">
              {migrationStatus?.migratedDocuments || 0}
            </div>
            <div className="text-xs text-gray-500 mt-1">Desde Google Drive</div>
          </div>

          <div className="bg-yellow-50 p-4 rounded">
            <div className="text-sm text-gray-600">Pendientes de Migración</div>
            <div className="text-2xl font-bold text-yellow-600">
              {migrationStatus?.pendingMigration || 0}
            </div>
            <div className="text-xs text-gray-500 mt-1">Archivos en Google Drive</div>
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded mb-4">
          <h3 className="font-semibold mb-2">📁 Estructura de Almacenamiento</h3>
          <div className="text-sm text-gray-600 font-mono space-y-1">
            <div>/storage/documentos-pago/</div>
            <div className="ml-4">├── proveedores/</div>
            <div className="ml-4">├── clientes/</div>
            <div className="ml-4">├── facturas/</div>
            <div className="ml-4">├── comprobantes/</div>
            <div className="ml-4">├── evidencias/</div>
            <div className="ml-4">├── xml/</div>
            <div className="ml-4">├── pdf/</div>
            <div className="ml-4">└── imagenes/</div>
          </div>
        </div>

        <div className="bg-blue-50 p-4 rounded mb-4">
          <h3 className="font-semibold mb-2">ℹ️ Características del Sistema</h3>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>✓ Almacenamiento local seguro</li>
            <li>✓ Detección automática de duplicados por hash SHA-256</li>
            <li>✓ Auditoría completa de todas las acciones</li>
            <li>✓ Control de permisos por rol</li>
            <li>✓ Respaldo automático incluido en el backup general del sistema</li>
            <li>✓ Sin dependencia de servicios externos (Google Drive eliminado)</li>
          </ul>
        </div>

        {migrationStatus && migrationStatus.pendingMigration > 0 && (
          <div className="mt-6">
            <button
              onClick={handleMigrate}
              disabled={migrating}
              className={`w-full py-3 px-4 rounded font-semibold ${
                migrating
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {migrating ? 'Migrando documentos...' : `Migrar ${migrationStatus.pendingMigration} documentos desde Google Drive`}
            </button>
            <p className="text-xs text-gray-500 mt-2 text-center">
              Los documentos originales en Google Drive no serán eliminados automáticamente
            </p>
          </div>
        )}

        {migrationStatus && migrationStatus.pendingMigration === 0 && migrationStatus.totalGDriveDocuments > 0 && (
          <div className="bg-green-50 border border-green-200 p-4 rounded">
            <div className="text-green-800 font-semibold">✓ Migración Completada</div>
            <div className="text-sm text-green-600 mt-1">
              Todos los documentos de Google Drive han sido migrados exitosamente al almacenamiento interno.
            </div>
          </div>
        )}

        {migrationStatus && migrationStatus.totalGDriveDocuments === 0 && (
          <div className="bg-gray-50 border border-gray-200 p-4 rounded">
            <div className="text-gray-800 font-semibold">✓ Sistema Configurado Correctamente</div>
            <div className="text-sm text-gray-600 mt-1">
              No hay documentos en Google Drive. El sistema está utilizando almacenamiento interno.
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Información Técnica</h2>
        
        <div className="space-y-3 text-sm">
          <div>
            <span className="font-semibold">Base de datos:</span> payment_documents
          </div>
          <div>
            <span className="font-semibold">Auditoría:</span> payment_document_audit
          </div>
          <div>
            <span className="font-semibold">Ruta física:</span> /home/user/apps/web/public/storage/documentos-pago/
          </div>
          <div>
            <span className="font-semibold">Formato de nombres:</span> PAGO-[ID]_[FECHA]_[PROVEEDOR]_[TIPO]_[TIMESTAMP].[EXT]
          </div>
          <div>
            <span className="font-semibold">Seguridad:</span> Control de acceso por rol, bitácora obligatoria
          </div>
          <div>
            <span className="font-semibold">Backup:</span> Incluido automáticamente en respaldo general del sistema
          </div>
        </div>
      </div>
    </div>
  );
}

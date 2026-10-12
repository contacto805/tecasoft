import { useState, useEffect, useCallback } from 'react';

export function useMaterialAlerts(materialId = null) {
  const [alerts, setAlerts] = useState([]);
  const [triggeredAlerts, setTriggeredAlerts] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const url = materialId
        ? `/api/material-alerts?materialId=${materialId}`
        : '/api/material-alerts';

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setAlerts(data);
      } else {
        const err = await response.json().catch(() => ({}));
        console.error('Error fetching alerts:', err?.error || err?.message || JSON.stringify(err));
      }
    } catch (error) {
      console.error('Error fetching alerts:', error?.message || String(error));
    } finally {
      setLoading(false);
    }
  }, [materialId]);

  const fetchTriggeredAlerts = useCallback(async () => {
    try {
      const response = await fetch('/api/material-alerts/triggered');
      if (response.ok) {
        const data = await response.json();
        setTriggeredAlerts(data);
      } else {
        const err = await response.json().catch(() => ({}));
        console.error('Error fetching triggered alerts:', err?.error || err?.message || String(err));
      }
    } catch (error) {
      console.error('Error fetching triggered alerts:', error?.message || String(error));
    }
  }, []);

  const createAlert = useCallback(async (alertData) => {
    try {
      const response = await fetch('/api/material-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alertData),
      });

      if (response.ok) {
        const newAlert = await response.json();
        setAlerts([...alerts, newAlert]);
        return { success: true, data: newAlert };
      } else {
        const error = await response.json();
        return { success: false, error: error.error };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, [alerts]);

  const updateAlert = useCallback(async (id, alertData) => {
    try {
      const response = await fetch('/api/material-alerts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...alertData }),
      });

      if (response.ok) {
        const updatedAlert = await response.json();
        setAlerts(alerts.map((a) => (a.id === id ? updatedAlert : a)));
        return { success: true, data: updatedAlert };
      } else {
        const error = await response.json();
        return { success: false, error: error.error };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, [alerts]);

  const deleteAlert = useCallback(async (id) => {
    try {
      const response = await fetch(`/api/material-alerts?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setAlerts(alerts.filter((a) => a.id !== id));
        return { success: true };
      } else {
        const error = await response.json();
        return { success: false, error: error.error };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, [alerts]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  useEffect(() => {
    fetchTriggeredAlerts();
    const interval = setInterval(fetchTriggeredAlerts, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [fetchTriggeredAlerts]);

  return {
    alerts,
    triggeredAlerts,
    loading,
    fetchAlerts,
    fetchTriggeredAlerts,
    createAlert,
    updateAlert,
    deleteAlert,
  };
}

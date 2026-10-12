import { useState, useEffect } from 'react';

export function useBatchTracking(lotId = null) {
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBatches = async (specificLotId = null) => {
    try {
      setLoading(true);
      setError(null);

      const url = specificLotId 
        ? `/api/batch-tracking?lotId=${specificLotId}`
        : `/api/batch-tracking`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Error fetching batch data');
      }

      const data = await response.json();

      if (specificLotId) {
        setSelectedBatch(data);
      } else {
        setBatches(data);
      }
    } catch (err) {
      console.error('Error in useBatchTracking:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (lotId) {
      fetchBatches(lotId);
    } else {
      fetchBatches();
    }
  }, [lotId]);

  const getBatchStats = () => {
    if (!batches || batches.length === 0) return null;

    const totalBatches = batches.length;
    const totalRevenue = batches.reduce((sum, b) => sum + (b.revenue || 0), 0);
    const totalCost = batches.reduce((sum, b) => sum + (b.cost || 0), 0);
    const totalProfit = totalRevenue - totalCost;
    const avgProfitMargin = batches.length > 0
      ? batches.reduce((sum, b) => sum + (b.profitMargin || 0), 0) / batches.length
      : 0;

    const profitableCount = batches.filter(b => b.profit > 0).length;
    const lossCount = batches.filter(b => b.profit < 0).length;

    return {
      totalBatches,
      totalRevenue,
      totalCost,
      totalProfit,
      avgProfitMargin,
      profitableCount,
      lossCount,
      profitPerBatch: totalBatches > 0 ? (totalProfit / totalBatches) : 0
    };
  };

  const sortBatchesByProfit = (direction = 'desc') => {
    const sorted = [...batches].sort((a, b) => {
      return direction === 'desc' 
        ? (b.profit || 0) - (a.profit || 0)
        : (a.profit || 0) - (b.profit || 0);
    });
    setBatches(sorted);
  };

  const sortBatchesByMargin = (direction = 'desc') => {
    const sorted = [...batches].sort((a, b) => {
      return direction === 'desc'
        ? (b.profitMargin || 0) - (a.profitMargin || 0)
        : (a.profitMargin || 0) - (b.profitMargin || 0);
    });
    setBatches(sorted);
  };

  return {
    batches,
    selectedBatch,
    loading,
    error,
    getBatchStats,
    refetch: fetchBatches,
    setSelectedBatch,
    sortBatchesByProfit,
    sortBatchesByMargin
  };
}

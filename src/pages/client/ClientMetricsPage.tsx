import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import type { Client } from '../../types/client';
import {
  clientMetricsApi,
  ClientMetric,
  ClientMetricSummary,
  MetricType,
} from '../../services/client-metrics';
import {
  PlusIcon,
  ChartBarIcon,
  ScaleIcon,
  FireIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface ClientContext {
  client: Client;
}

export function ClientMetricsPage() {
  const { client } = useOutletContext<ClientContext>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [metrics, setMetrics] = useState<ClientMetric[]>([]);
  const [summaries, setSummaries] = useState<ClientMetricSummary[]>([]);
  const [newMetric, setNewMetric] = useState({
    type: 'weight' as MetricType,
    value: '',
    unit: 'kg',
    date: new Date().toISOString().split('T')[0],
  });

  const metricTypes = [
    { value: 'weight' as MetricType, label: 'Peso', unit: 'kg', icon: ScaleIcon },
    { value: 'body_fat' as MetricType, label: 'Grasa Corporal %', unit: '%', icon: FireIcon },
    { value: 'chest' as MetricType, label: 'Pecho', unit: 'cm', icon: ChartBarIcon },
    { value: 'waist' as MetricType, label: 'Cintura', unit: 'cm', icon: ChartBarIcon },
    { value: 'hips' as MetricType, label: 'Cadera', unit: 'cm', icon: ChartBarIcon },
    { value: 'arms' as MetricType, label: 'Brazos', unit: 'cm', icon: ChartBarIcon },
    { value: 'thighs' as MetricType, label: 'Muslos', unit: 'cm', icon: ChartBarIcon },
  ];

  const loadData = useCallback(async () => {
    try {
      const [metricsResponse, summaryResponse] = await Promise.all([
        clientMetricsApi.getMetrics(client.id),
        clientMetricsApi.getSummary(client.id),
      ]);
      setMetrics(metricsResponse.metrics);
      setSummaries(summaryResponse);
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setIsLoading(false);
    }
  }, [client.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddMetric = async () => {
    if (!newMetric.value) {
      toast.error('Por favor ingresa un valor');
      return;
    }
    setIsSaving(true);
    try {
      await clientMetricsApi.createMetric(client.id, {
        metric_type: newMetric.type,
        value: parseFloat(newMetric.value),
        unit: newMetric.unit,
        date: newMetric.date,
      });
      toast.success('Medición guardada correctamente');
      setShowAddModal(false);
      setNewMetric({
        type: 'weight',
        value: '',
        unit: 'kg',
        date: new Date().toISOString().split('T')[0],
      });
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar la medición');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMetric = async (metricId: string) => {
    if (!confirm('¿Estás seguro de eliminar esta medición?')) return;
    try {
      await clientMetricsApi.deleteMetric(metricId);
      toast.success('Medición eliminada');
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Error al eliminar');
    }
  };

  const getMetricLabel = (type: MetricType) => {
    return metricTypes.find((t) => t.value === type)?.label || type;
  };

  const getSummaryForType = (type: MetricType) => {
    return summaries.find((s) => s.metric_type === type);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Client Metrics</h1>
          <p className="mt-1 text-gray-600">
            Track progress and measurements for {client.full_name}
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowAddModal(true)}>
          <PlusIcon className="h-5 w-5 mr-2" />
          Add Measurement
        </Button>
      </div>

      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {metricTypes.slice(0, 3).map((type) => {
          const summary = getSummaryForType(type.value);
          return (
            <Card key={type.value}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{type.label}</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {summary?.latest_value !== null ? `${summary?.latest_value} ${summary?.unit}` : '--'}
                  </p>
                  {summary?.change_from_previous !== null && summary?.change_from_previous !== undefined ? (
                    <p className={`text-xs ${summary.change_from_previous > 0 ? 'text-red-500' : 'text-green-500'}`}>
                      {summary.change_from_previous > 0 ? '+' : ''}{summary.change_from_previous.toFixed(1)} desde última medición
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400">
                      {summary?.latest_date ? format(new Date(summary.latest_date), 'dd/MM/yyyy') : 'Sin datos'}
                    </p>
                  )}
                </div>
                <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
                  <type.icon className="h-6 w-6 text-primary-600" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Progress Chart Placeholder */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Progress Over Time</h3>
        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <div className="text-center text-gray-500">
            <ChartBarIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>Progress charts will appear here</p>
            <p className="text-sm">Add measurements to see your client's progress</p>
          </div>
        </div>
      </Card>

      {/* Measurement History */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Measurement History</h3>
        {metrics.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <ScaleIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>No measurements recorded yet</p>
            <p className="text-sm mt-1">Start tracking by adding the first measurement</p>
            <Button
              variant="secondary"
              className="mt-4"
              onClick={() => setShowAddModal(true)}
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Add First Measurement
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Fecha</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Tipo</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Valor</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((metric) => (
                  <tr key={metric.id} className="border-b border-gray-100">
                    <td className="py-3 px-4 text-sm text-gray-900">
                      {format(new Date(metric.date), 'dd/MM/yyyy')}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900">
                      {getMetricLabel(metric.metric_type)}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900">
                      {metric.value} {metric.unit}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDeleteMetric(metric.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add Metric Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add Measurement</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Metric Type
                </label>
                <select
                  value={newMetric.type}
                  onChange={(e) => {
                    const selected = metricTypes.find((t) => t.value === e.target.value);
                    setNewMetric({
                      ...newMetric,
                      type: e.target.value as MetricType,
                      unit: selected?.unit || 'kg',
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  {metricTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label={`Value (${newMetric.unit})`}
                type="number"
                value={newMetric.value}
                onChange={(e) => setNewMetric({ ...newMetric, value: e.target.value })}
                placeholder="Enter value"
              />
              <Input
                label="Date"
                type="date"
                value={newMetric.date}
                onChange={(e) => setNewMetric({ ...newMetric, date: e.target.value })}
              />
            </div>
            <div className="flex gap-2 mt-6">
              <Button
                variant="secondary"
                onClick={() => setShowAddModal(false)}
                className="flex-1"
                disabled={isSaving}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={handleAddMetric}
                className="flex-1"
                isLoading={isSaving}
              >
                Agregar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

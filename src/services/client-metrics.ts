import { apiClient } from './api';

export type MetricType = 'weight' | 'body_fat' | 'muscle_mass' | 'chest' | 'waist' | 'hips' | 'arm_left' | 'arm_right' | 'thigh_left' | 'thigh_right' | 'calf_left' | 'calf_right' | 'visceral_fat' | 'arms' | 'thighs' | 'calves' | 'systolic' | 'diastolic' | 'glucose' | 'blood_pressure';

export interface ClientMetric {
  id: string;
  client_id: string;
  metric_type: MetricType;
  value: number;
  unit: string;
  date: string;
  created_at: string;
  updated_at: string;
}

export interface ClientMetricCreate {
  metric_type: MetricType;
  value: number;
  unit: string;
  date: string;
}

export interface ClientMetricUpdate {
  metric_type?: MetricType;
  value?: number;
  unit?: string;
  date?: string;
}

export interface ClientMetricListResponse {
  metrics: ClientMetric[];
  total: number;
}

export interface ClientMetricSummary {
  metric_type: MetricType;
  latest_value: number | null;
  latest_date: string | null;
  unit: string;
  change_from_previous: number | null;
}

export const clientMetricsApi = {
  getMetrics: (clientId: string, params?: {
    metric_type?: MetricType;
    start_date?: string;
    end_date?: string;
    skip?: number;
    limit?: number;
  }): Promise<ClientMetricListResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.metric_type) queryParams.append('metric_type', params.metric_type);
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);
    if (params?.skip !== undefined) queryParams.append('skip', params.skip.toString());
    if (params?.limit !== undefined) queryParams.append('limit', params.limit.toString());

    const queryString = queryParams.toString();
    return apiClient.get<ClientMetricListResponse>(
      `/client-metrics/${clientId}${queryString ? `?${queryString}` : ''}`
    );
  },

  getSummary: (clientId: string): Promise<ClientMetricSummary[]> => {
    return apiClient.get<ClientMetricSummary[]>(`/client-metrics/${clientId}/summary`);
  },

  createMetric: (clientId: string, data: ClientMetricCreate): Promise<ClientMetric> => {
    return apiClient.post<ClientMetric>(`/client-metrics/${clientId}`, data);
  },

  updateMetric: (metricId: string, data: ClientMetricUpdate): Promise<ClientMetric> => {
    return apiClient.put<ClientMetric>(`/client-metrics/${metricId}`, data);
  },

  deleteMetric: (metricId: string): Promise<void> => {
    return apiClient.delete<void>(`/client-metrics/${metricId}`);
  },
};

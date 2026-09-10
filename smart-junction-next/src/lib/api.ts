import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Simple Token Management
export const setToken = (token: string) => {
  if (typeof window !== 'undefined' && token) {
    localStorage.setItem('auth_token', token);
    apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
  }
};

export const getToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('auth_token');
  }
  return null;
};

// Auto-attach token
apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const api = {
  auth: {
    login: (email: string, password: string) =>
      apiClient.post('/auth/login', { email, password }).then((res) => res.data),
  },
  hospitals: {
    getAll: () => apiClient.get('/hospitals').then((res) => res.data.data),
  },
  emergencies: {
    create: (data: any) => apiClient.post('/emergencies', data).then((res) => res.data.data),
    triage: (symptoms: string, vitals?: string) => apiClient.post('/emergencies/triage', { symptoms, vitals }).then((res) => res.data.data),
  },
  routes: {
    calculate: (data: any) => apiClient.post('/routes/calculate', data).then((res) => res.data.data),
    recalculate: (data: any) => apiClient.post('/routes/recalculate', data).then((res) => res.data.data),
  }
};

export default apiClient;

import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

const TOKEN_KEY = 'rannikon_token';

const api = axios.create({
  baseURL: 'https://api.rannikon.com',
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
    return Promise.reject(error);
  }
);

export default api;

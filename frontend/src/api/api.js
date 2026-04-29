import axios from 'axios';

const API_URL = 'https://uhc-backend.onrender.com/api'; // replace with your backend URL if different

const api = axios.create({
  baseURL: API_URL,
});

// Automatically attach JWT token to requests
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;

import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  (config) => {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  (error) => {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.error('❌ API Request Error:', error);
    }
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ API Response: ${response.status} ${response.config.url}`);
    }
    return response;
  },
  (error) => {
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ API Response Error:', error.response?.data || error.message);
    }
    return Promise.reject(error);
  }
);

export const roomAPI = {
  createRoom: async (ttl = 3600, options = {}) => {
    try {
      const response = await api.post('/rooms', { ttl, ...options });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to create room');
    }
  },
  getRoom: async (roomId) => {
    try {
      const response = await api.get(`/rooms/${roomId}`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) throw new Error('Room not found');
      throw new Error(error.response?.data?.error || 'Failed to get room');
    }
  },
  deleteRoom: async (roomId) => {
    try {
      const response = await api.delete(`/rooms/${roomId}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to delete room');
    }
  },
  joinRoom: async (roomId, body) => {
    try {
      const response = await api.post(`/rooms/${roomId}/join`, body);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to join room');
    }
  },
  createInvite: async (roomId, ttlSeconds = 1800) => {
    try {
      const response = await api.post(`/rooms/${roomId}/invite`, { ttlSeconds });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to create invite');
    }
  },
  leaveRoom: async (roomId, clientId) => {
    try {
      const response = await api.post(`/rooms/${roomId}/leave`, { clientId });
      return response.data;
    } catch (_e) {
      // Best-effort — don't block the user from navigating away
      return { success: false };
    }
  }
};

export const messageAPI = {
  sendMessage: async (roomId, messageData, ttl = 300) => {
    try {
      const response = await api.post(`/rooms/${roomId}/messages`, { ...messageData, ttl });
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) throw new Error('Room not found');
      throw new Error(error.response?.data?.error || 'Failed to send message');
    }
  },
  getMessages: async (roomId) => {
    try {
      const response = await api.get(`/rooms/${roomId}/messages`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) throw new Error('Room not found');
      throw new Error(error.response?.data?.error || 'Failed to get messages');
    }
  },
  deleteMessage: async (roomId, messageId) => {
    try {
      const response = await api.delete(`/rooms/${roomId}/messages/${messageId}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to delete message');
    }
  }
};

export const attachmentsAPI = {
  init: async (roomId, { mimeType, ttlMs, viewOnce = false, category = 'chat' }) => {
    try {
      const response = await api.post(`/rooms/${roomId}/attachments/init`, { mimeType, ttlMs, viewOnce, category });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to init attachment');
    }
  },
  upload: async (roomId, id, uploadToken, ciphertextBytes) => {
    try {
      const response = await api.put(`/rooms/${roomId}/attachments/${id}`, ciphertextBytes, {
        headers: { 'Authorization': `Bearer ${uploadToken}`, 'Content-Type': 'application/octet-stream' },
        transformRequest: [(data) => data],
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to upload attachment');
    }
  },
  mintDownloadToken: async (roomId, id, ttlSeconds = 300) => {
    try {
      const response = await api.post(`/rooms/${roomId}/attachments/token`, { id, ttlSeconds });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to mint download token');
    }
  },
  buildDownloadUrl: (baseUrl, roomId, id, token) => {
    const root = baseUrl || (process.env.REACT_APP_API_URL || 'http://localhost:3001/api');
    return `${root}/rooms/${roomId}/attachments/${id}?token=${encodeURIComponent(token)}`;
  },
  delete: async (roomId, id) => {
    try {
      const response = await api.post(`/rooms/${roomId}/attachments/${id}/delete`, {});
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to delete attachment');
    }
  }
};

export const healthAPI = {
  checkHealth: async () => {
    try {
      const response = await api.get('/health');
      return response.data;
    } catch (error) {
      throw new Error('API health check failed');
    }
  }
};

export default api;

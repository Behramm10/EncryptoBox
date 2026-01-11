import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    // eslint-disable-next-line no-console
    console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    // eslint-disable-next-line no-console
    console.error('❌ API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    // eslint-disable-next-line no-console
    console.log(`✅ API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('❌ API Response Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

/**
 * Room API functions
 */
export const roomAPI = {
  /**
   * Create a new room
   * @param {number} ttl - Room time-to-live in seconds (default: 3600)
   * @returns {Promise<Object>} - Room creation response
   */
  createRoom: async (ttl = 3600, options = {}) => {
    try {
      const response = await api.post('/rooms', { ttl, ...options });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to create room');
    }
  },

  /**
   * Check if a room exists
   * @param {string} roomId - The room ID to check
   * @returns {Promise<Object>} - Room information
   */
  getRoom: async (roomId) => {
    try {
      const response = await api.get(`/rooms/${roomId}`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error('Room not found');
      }
      throw new Error(error.response?.data?.error || 'Failed to get room');
    }
  },

  /**
   * Delete a room
   * @param {string} roomId - The room ID to delete
   * @returns {Promise<Object>} - Deletion response
   */
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
  }
};

/**
 * Message API functions
 */
export const messageAPI = {
  /**
   * Send a message to a room
   * @param {string} roomId - The room ID
   * @param {Object} messageData - Encrypted message data
   * @param {number} ttl - Message time-to-live in seconds (default: 300)
   * @returns {Promise<Object>} - Message creation response
   */
  sendMessage: async (roomId, messageData, ttl = 300) => {
    try {
      const response = await api.post(`/rooms/${roomId}/messages`, {
        ...messageData,
        ttl
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error('Room not found');
      }
      throw new Error(error.response?.data?.error || 'Failed to send message');
    }
  },

  /**
   * Get all messages from a room
   * @param {string} roomId - The room ID
   * @returns {Promise<Object>} - Messages response
   */
  getMessages: async (roomId) => {
    try {
      const response = await api.get(`/rooms/${roomId}/messages`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error('Room not found');
      }
      throw new Error(error.response?.data?.error || 'Failed to get messages');
    }
  },

  /**
   * Delete a specific message
   * @param {string} roomId - The room ID
   * @param {string} messageId - The message ID to delete
   * @returns {Promise<Object>} - Deletion response
   */
  deleteMessage: async (roomId, messageId) => {
    try {
      const response = await api.delete(`/rooms/${roomId}/messages/${messageId}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to delete message');
    }
  }
};

/**
 * Attachments API functions
 */
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
      const response = await api.put(`/rooms/${roomId}/attachments/${id}`,
        ciphertextBytes,
        {
          headers: {
            'Authorization': `Bearer ${uploadToken}`,
            'Content-Type': 'application/octet-stream'
          },
          transformRequest: [(data) => data],
        }
      );
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

/**
 * Health check API
 */
export const healthAPI = {
  /**
   * Check if the API is healthy
   * @returns {Promise<Object>} - Health status
   */
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

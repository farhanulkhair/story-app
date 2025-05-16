const CONFIG = {
  BASE_URL: 'https://story-api.dicoding.dev/v1',
  DEFAULT_LANGUAGE: 'id',
  CACHE_NAME: 'StoryApp-v1',
  DATABASE_NAME: 'story-app-db',
  DATABASE_VERSION: 1,
  OBJECT_STORE_NAME: 'stories',
  PUSH_MSG_VAPID_PUBLIC_KEY: 'BCCs2eonMI-6H2ctvFaWg-UYdDv387Vno_bzUzALpB442r2lCnsHmtrx8biyPi_E-1fSGABK_Qs_GlvPoJJqxbk',
  PUSH_MSG_SUBSCRIBE_URL: '/notifications/subscribe',
  PUSH_MSG_UNSUBSCRIBE_URL: '/notifications/subscribe', // Same URL as subscribe but with DELETE method
  WS_URL: 'wss://story-api.dicoding.dev',
  API_HEADERS: {
    'Content-Type': 'application/json',
    'X-Skip-Interceptor': true,
  },
  API_TIMEOUT: 10000, // 10 seconds
  CACHE_EXPIRATION: 60 * 60 * 1000, // 1 hour
  // API Endpoints
  ENDPOINTS: {
    REGISTER: '/register',
    LOGIN: '/login',
    STORIES: '/stories',
    GUEST_STORY: '/stories/guest'
  }
};

export default CONFIG;
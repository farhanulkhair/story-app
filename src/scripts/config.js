const CONFIG = {
  BASE_URL: 'https://story-api.dicoding.dev/v1',
  DEFAULT_LANGUAGE: 'id',
  CACHE_NAME: 'StoryApp-v1',
  DATABASE_NAME: 'story-app-db',
  DATABASE_VERSION: 1,
  OBJECT_STORE_NAME: 'stories',
  PUSH_MSG_VAPID_PUBLIC_KEY: 'BCCs2eonMI-6H2ctvFaWg-UYdDv387Vno_bzUzALpB442r2lCnsHmtrx8biyPi_E-1fSGABK_Qs_GlvPoJJqxbk',
  PUSH_MSG_SUBSCRIBE_URL: '/notifications/subscribe',
  PUSH_MSG_UNSUBSCRIBE_URL: '/notifications/subscribe', // DELETE method untuk unsubscribe
  WS_URL: 'wss://story-api.dicoding.dev',
  // API Endpoints
  ENDPOINTS: {
    REGISTER: '/register',
    LOGIN: '/login',
    STORIES: '/stories',
    GUEST_STORY: '/stories/guest'
  }
};

export default CONFIG;
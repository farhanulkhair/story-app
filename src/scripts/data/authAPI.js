import CONFIG from "../config.js";

class AuthAPI {
  constructor() {
    this.baseUrl = CONFIG.BASE_URL;
  }

  // Generic POST request for auth endpoints
  async #post(endpoint, body) {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      
      const responseJson = await response.json();
      
      if (responseJson.error) {
        return { error: true, message: responseJson.message };
      }
      
      return { error: false, data: responseJson };
    } catch (error) {
      return { error: true, message: "Network Error" };
    }
  }

  // Register a new user
  async register({ name, email, password }) {
    if (!name || !email || !password) {
      return { error: true, message: "Please fill all required fields" };
    }
    
    if (password.length < 8) {
      return { error: true, message: "Password must be at least 8 characters" };
    }
    
    const response = await this.#post("/register", { name, email, password });
    return response;
  }

  // Login user and get token
  async login({ email, password }) {
    if (!email || !password) {
      return { error: true, message: "Please fill all required fields" };
    }
    
    const response = await this.#post("/login", { email, password });
    
    if (!response.error && response.data.loginResult) {
      // Store token in localStorage for subsequent requests
      localStorage.setItem("token", response.data.loginResult.token);
      localStorage.setItem("user", JSON.stringify({
        id: response.data.loginResult.userId,
        name: response.data.loginResult.name
      }));
    }
    
    return response;
  }

  // Check if user is logged in
  isLoggedIn() {
    return !!localStorage.getItem("token");
  }

  // Get current user token
  getToken() {
    return localStorage.getItem("token");
  }

  // Get current user data
  getUser() {
    const user = localStorage.getItem("user");
    return user ? JSON.parse(user) : null;
  }

  // Logout user
  logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    return { error: false, message: "Logged out successfully" };
  }

  // Subscribe to push notifications
  async subscribePushNotification(subscription) {
    try {
      const token = this.getToken();
      if (!token) {
        return { error: true, message: "Not authenticated" };
      }

      const response = await fetch(`${CONFIG.BASE_URL}${CONFIG.PUSH_MSG_SUBSCRIBE_URL}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('p256dh')))),
            auth: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('auth')))),
          },
        }),
      });

      const responseJson = await response.json();
      
      if (responseJson.error) {
        console.error('Subscribe error:', responseJson);
        return { error: true, message: responseJson.message || "Gagal mengaktifkan notifikasi" };
      }
      
      return { error: false, data: responseJson };
    } catch (error) {
      console.error('Subscribe error:', error);
      return { error: true, message: "Gagal terhubung ke server" };
    }
  }

  // Unsubscribe from push notifications
  async unsubscribePushNotification(subscription) {
    try {
      const token = this.getToken();
      if (!token) {
        return { error: true, message: "Not authenticated" };
      }

      const response = await fetch(`${CONFIG.BASE_URL}${CONFIG.PUSH_MSG_UNSUBSCRIBE_URL}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint
        }),
      });

      const responseJson = await response.json();
      
      if (responseJson.error) {
        console.error('Unsubscribe error:', responseJson);
        return { error: true, message: responseJson.message || "Gagal menonaktifkan notifikasi" };
      }
      
      await subscription.unsubscribe();
      return { error: false, data: responseJson };
    } catch (error) {
      console.error('Unsubscribe error:', error);
      return { error: true, message: "Gagal terhubung ke server" };
    }
  }
}

export default new AuthAPI();
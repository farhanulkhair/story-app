class LoginPresenter {
  #view;
  #authAPI;

  constructor({ view, authAPI }) {
    this.#view = view;
    this.#authAPI = authAPI;
  }

  async getLogin({ email, password }) {
    this.#view.showSubmitLoadingButton();
    
    try {
      // Validate inputs
      if (!email || !password) {
        this.#view.loginFailed('Email dan password harus diisi');
        return;
      }
      
      const response = await this.#authAPI.login({ email, password });

      if (response.error) {
        console.error('getLogin: response:', response);
        this.#view.loginFailed(response.message);
        return;
      }

      // Login successful
      const userData = response.data.loginResult;
      this.#view.loginSuccessfully('Login berhasil');
    } catch (error) {
      console.error('getLogin: error:', error);
      this.#view.loginFailed(error.message);
    } finally {
      this.#view.hideSubmitLoadingButton();
    }
  }
}

export default LoginPresenter;
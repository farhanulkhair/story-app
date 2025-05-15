class RegisterPresenter {
  #view;
  #authAPI;

  constructor({ view, authAPI }) {
    this.#view = view;
    this.#authAPI = authAPI;
  }

  async getRegistered({ name, email, password }) {
    this.#view.showSubmitLoadingButton();
    
    try {
      // Validate inputs
      if (!name || !email || !password) {
        this.#view.registeredFailed('Semua kolom harus diisi');
        return;
      }
      
      if (password.length < 8) {
        this.#view.registeredFailed('Password minimal 8 karakter');
        return;
      }
      
      const response = await this.#authAPI.register({ name, email, password });

      if (response.error) {
        console.error('getRegistered: response:', response);
        this.#view.registeredFailed(response.message);
        return;
      }

      // Registration successful
      this.#view.registeredSuccessfully('Registrasi berhasil! Silakan login.');
    } catch (error) {
      console.error('getRegistered: error:', error);
      this.#view.registeredFailed(error.message);
    } finally {
      this.#view.hideSubmitLoadingButton();
    }
  }
}

export default RegisterPresenter;
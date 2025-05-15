class AboutPage {
  async render() {
    return `
      <section class="about" id="mainContent" tabindex="0">
        <div class="about__content">
          <h2 class="content__heading">Tentang Kami</h2>
          <p class="about__intro">
            StoryApp adalah platform inovatif untuk berbagi cerita pengalaman, petualangan, dan inspirasi. 
            Dengan antarmuka yang intuitif, kamu dapat mengunggah cerita dengan foto, menandai lokasi di peta interaktif, 
            dan menjelajahi kisah dari komunitas global kami.
          </p>

          <h3 class="about__subheading">Misi Kami</h3>
          <p class="about__mission">
            Kami percaya setiap cerita memiliki kekuatan untuk menginspirasi dan menghubungkan. 
            StoryApp hadir untuk memberi ruang bagi semua orang untuk menceritakan kisah mereka, 
            dari petualangan kecil hingga momen yang mengubah hidup.
          </p>

          <h3 class="about__subheading">Fitur Unggulan</h3>
          <div class="about__features">
            <div class="feature__item">
              <i class="fas fa-camera"></i>
              <h4>Unggah dengan Mudah</h4>
              <p>Abadikan momen dengan foto langsung dari kamera dan bagikan ceritamu dalam hitungan detik.</p>
            </div>
            <div class="feature__item">
              <i class="fas fa-map-marked-alt"></i>
              <h4>Peta Interaktif</h4>
              <p>Tandai lokasi ceritamu dan jelajahi kisah dari berbagai penjuru dunia di peta kami.</p>
            </div>
            <div class="feature__item">
              <i class="fas fa-globe"></i>
              <h4>Komunitas Global</h4>
              <p>Terhubung dengan pengguna lain, temukan inspirasi, dan jadilah bagian dari komunitas StoryApp.</p>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  async afterRender() {
    // Add smooth scroll only for in-page anchor links (not routing links like #/home, #/add)
    document.querySelectorAll('a[href^="#"]:not([href^="#/"])').forEach((anchor) => {
      anchor.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = anchor.getAttribute('href').substring(1);
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
  }
}

export default AboutPage;
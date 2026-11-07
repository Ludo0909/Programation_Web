if (localStorage.getItem('site-theme') === 'dark') {
  document.documentElement.classList.add('dark-theme');
} else {
  document.documentElement.classList.remove('dark-theme');
}

document.addEventListener("DOMContentLoaded", () => {
  const fabContainer = document.getElementById("fab-container");
  const fabBtn = document.getElementById("fab-btn");

  if (!fabBtn || !fabContainer) return;

  const toggleFab = (e) => {
    e.preventDefault();
    e.stopPropagation();
    fabContainer.classList.toggle("active");
  };

  // Détection prioritaire de l'appui tactile ou du clic
  fabBtn.addEventListener("pointerdown", toggleFab);

  // Fermer le menu si on touche n'importe où ailleurs sur l'écran
  document.addEventListener("pointerdown", (e) => {
    if (!fabContainer.contains(e.target)) {
      fabContainer.classList.remove("active");
    }
  });
});
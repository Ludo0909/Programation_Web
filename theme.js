if (localStorage.getItem('site-theme') === 'dark') {
  document.documentElement.classList.add('dark-theme');
} else {
  document.documentElement.classList.remove('dark-theme');
}

document.addEventListener("DOMContentLoaded", () => {
  const fabContainer = document.getElementById("fab-container");
  const fabBtn = document.getElementById("fab-btn");

  fabBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    fabContainer?.classList.toggle("active");
  });

  document.addEventListener("click", (e) => {
    if (!fabContainer?.contains(e.target)) {
      fabContainer?.classList.remove("active");
    }
  });
});
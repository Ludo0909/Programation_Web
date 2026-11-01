document.addEventListener("DOMContentLoaded", async () => {
  let currentDate = new Date();
  let eventsList = [];
  let currentUser = null;

  // Récupération de l'utilisateur connecté
  const { data: { user } } = await supabaseClient.auth.getUser();
  currentUser = user;

  const monthDisplay = document.getElementById("month-display");
  const calendarDays = document.getElementById("calendar-days");
  const modal = document.getElementById("event-modal");
  const form = document.getElementById("event-form");
  const selectedDateInput = document.getElementById("selected-date");
  const modalDateTitle = document.getElementById("modal-date-title");

  // Charger les événements depuis Supabase
  async function loadEvents() {
    const { data, error } = await supabaseClient
      .from("events")
      .select("*");
    if (!error && data) {
      eventsList = data;
    }
    renderCalendar();
  }

  // Rendu de la grille mensuelle
  function renderCalendar() {
    calendarDays.innerHTML = "";
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    monthDisplay.textContent = new Intl.DateTimeFormat("fr-FR", {
      month: "long",
      year: "numeric"
    }).format(currentDate);

    // Déterminer les jours du mois
    const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // Lundi = 0
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    // Cases du mois précédent
    for (let x = firstDayIndex; x > 0; x--) {
      const cell = document.createElement("div");
      cell.classList.add("cal-day-cell", "inactive");
      cell.innerHTML = `<span class="day-number">${prevMonthDays - x + 1}</span>`;
      calendarDays.appendChild(cell);
    }

    // Cases du mois en cours
    const today = new Date();
    for (let i = 1; i <= totalDays; i++) {
      const cell = document.createElement("div");
      cell.classList.add("cal-day-cell");

      if (i === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
        cell.classList.add("today");
      }

      const formattedDay = `${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      cell.innerHTML = `<span class="day-number">${i}</span>`;

      // Afficher les badges d'événements existants
      const dayEvents = eventsList.filter(ev => ev.start_time.startsWith(formattedDay));
      dayEvents.forEach(ev => {
        const tag = document.createElement("div");
        tag.classList.add("event-tag", `tag-${ev.category}`);
        tag.textContent = ev.title;
        cell.appendChild(tag);
      });

      // Clic pour ouvrir le modal sur ce jour
      cell.addEventListener("click", () => {
        selectedDateInput.value = formattedDay;
        modalDateTitle.textContent = `Ajouter le ${i}/${month + 1}/${year}`;
        modal.style.display = "flex";
      });

      calendarDays.appendChild(cell);
    }
  }

  // Navigation mois précédent / suivant
  document.getElementById("btn-prev").addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
  });

  document.getElementById("btn-next").addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
  });

  document.getElementById("btn-today").addEventListener("click", () => {
    currentDate = new Date();
    renderCalendar();
  });

  // Gestion du modal
  document.getElementById("btn-close-modal").addEventListener("click", () => {
    modal.style.display = "none";
  });

  // Soumission et enregistrement dans Supabase
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser) {
      alert("Session expirée. Veuillez vous reconnecter.");
      return;
    }

    const day = selectedDateInput.value;
    const startHour = document.getElementById("event-start").value;
    const endHour = document.getElementById("event-end").value;

    const newEvent = {
      title: document.getElementById("event-title").value,
      category: document.getElementById("event-category").value,
      start_time: `${day}T${startHour}:00Z`,
      end_time: `${day}T${endHour}:00Z`,
      user_id: currentUser.id
    };

    const { error } = await supabaseClient.from("events").insert(newEvent);

    if (error) {
      alert("Erreur lors de l'enregistrement : " + error.message);
    } else {
      modal.style.display = "none";
      form.reset();
      await loadEvents();
    }
  });

  await loadEvents();
});
let currentChannel = StorageService.readChannel();
let currentUser = null;
let unsubscribeMessages = null;
let allChannels = [];

const inputChannel = document.getElementById("input-channel");
const inputMessage = document.getElementById("input-message");
const searchChannels = document.getElementById("search-channels");
const ulChannels = document.getElementById("ul-channels");
const divMessages = document.getElementById("div-messages");
const spanChannelTitle = document.getElementById("span-channel-title");
const headerAvatar = document.getElementById("header-avatar");
const chatPlaceholder = document.getElementById("chat-placeholder");
const chatContainer = document.getElementById("chat-container");

// Créer un salon via la fenêtre modale
document.getElementById("form-channel")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = inputChannel.value.trim();
  if (!name || !currentUser) return;

  const { data: newChan, error } = await ChatDatabase.createChannel(name, currentUser.id);
  if (error) {
    alert("Impossible de créer le salon : " + error.message);
    return;
  }

  inputChannel.value = "";
  
  // Fermer la modale Bootstrap
  const modalEl = document.getElementById("newChannelModal");
  const modal = bootstrap.Modal.getInstance(modalEl);
  if (modal) modal.hide();

  await loadChannels();
  if (newChan) {
    const card = document.querySelector(`[data-id="${newChan.id}"]`);
    if (card) selectChannel(card, newChan);
  }
});

// Filtrer les salons en direct
searchChannels?.addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase();
  const filtered = allChannels.filter(c => c.name.toLowerCase().includes(query));
  renderChannels(filtered);
});

// Envoyer un message
document.getElementById("form-message")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const content = inputMessage.value.trim();
  if (!content || !currentChannel || !currentUser) return;

  const displayName = currentUser.user_metadata?.username || currentUser.user_metadata?.full_name || currentUser.email.split('@')[0];

  inputMessage.value = "";

  const { error } = await ChatDatabase.sendMessage(
    currentChannel.id,
    content,
    displayName,
    currentUser.id
  );

  if (error) {
    console.error("Erreur d'envoi :", error.message);
  }
});

// Redirection si déconnecté
AuthService.onSessionChange((event, session) => {
  if (event === "SIGNED_OUT" || !session) {
    StorageService.clearSession();
    window.location.replace("./index.html");
  }
});

// Charger les salons
async function loadChannels() {
  const { data: channels, error } = await ChatDatabase.fetchChannels();
  if (error) return;
  allChannels = channels || [];
  renderChannels(allChannels);
}

function renderChannels(channels) {
  ulChannels.replaceChildren();

  if (channels.length === 0) {
    ulChannels.innerHTML = '<div class="text-center text-muted small py-4">Aucun salon trouvé.</div>';
    return;
  }

  channels.forEach((channel) => {
    const card = document.createElement("div");
    card.className = "chat-card";
    card.setAttribute("data-id", channel.id);
    
    if (currentChannel && channel.id === currentChannel.id) {
      card.classList.add("active");
    }

    const firstLetter = channel.name.charAt(0).toUpperCase();
    card.innerHTML = `
      <div class="avatar">${firstLetter}</div>
      <div class="overflow-hidden">
        <h6 class="mb-0 text-truncate fw-bold"># ${channel.name}</h6>
        <small class="text-muted">Canal public</small>
      </div>
    `;

    card.onclick = () => selectChannel(card, channel);
    ulChannels.appendChild(card);
  });
}

async function selectChannel(cardElement, channel) {
  document.querySelectorAll(".chat-card").forEach((b) => b.classList.remove("active"));
  cardElement.classList.add("active");

  currentChannel = channel;
  StorageService.writeChannel(channel);

  if (chatPlaceholder) chatPlaceholder.style.display = "none";
  if (chatContainer) chatContainer.classList.add("active");

  if (spanChannelTitle) spanChannelTitle.textContent = "# " + channel.name;
  if (headerAvatar) headerAvatar.textContent = channel.name.charAt(0).toUpperCase();

  if (unsubscribeMessages) unsubscribeMessages();
  unsubscribeMessages = ChatDatabase.subscribeToMessages(channel.id, appendMessage);
  await loadMessages();
}

async function loadMessages() {
  const { data: messages, error } = await ChatDatabase.fetchMessages(currentChannel.id);
  if (error) return;

  divMessages.replaceChildren();
  messages.forEach((msg) => displayMessage(msg));
  divMessages.scrollTop = divMessages.scrollHeight;
}

function appendMessage(message) {
  displayMessage(message);
  divMessages.scrollTop = divMessages.scrollHeight;
}

function displayMessage(message) {
  const isMine = currentUser && (message.created_by === currentUser.id);

  const msgDiv = document.createElement("div");
  msgDiv.className = `message ${isMine ? "outgoing" : "incoming"}`;

  const textP = document.createElement("p");
  textP.textContent = message.content;

  const timeSpan = document.createElement("span");
  timeSpan.className = "time";
  
  const d = message.created_at ? new Date(message.created_at) : new Date();
  const timeFormatted = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  timeSpan.textContent = isMine ? timeFormatted : `${timeFormatted} · ${message.username || 'Anonyme'}`;

  msgDiv.append(textP, timeSpan);
  divMessages.appendChild(msgDiv);
}

// Initialisation au chargement
async function init() {
  const { user } = await AuthService.getUser();
  if (!user) {
    window.location.replace("./index.html");
    return;
  }
  currentUser = user;

  await loadChannels();
  ChatDatabase.subscribeToChannels(() => loadChannels());

  if (currentChannel) {
    const activeCard = document.querySelector(`[data-id="${currentChannel.id}"]`);
    if (activeCard) {
      selectChannel(activeCard, currentChannel);
    }
  }
}

init();

let currentCalDate = new Date();
let channelEvents = [];
let selectedCalDay = null;

// Boutons du panneau
const calPanel = document.getElementById("channel-calendar-panel");
const btnToggleCal = document.getElementById("btn-toggle-calendar");
const btnCloseCal = document.getElementById("btn-close-channel-cal");

btnToggleCal?.addEventListener("click", () => {
  if (!currentChannel) return;
  calPanel.classList.toggle("hidden");
  if (!calPanel.classList.contains("hidden")) {
    document.getElementById("cal-channel-name").textContent = currentChannel.name;
    loadChannelCalendar();
  }
});

btnCloseCal?.addEventListener("click", () => {
  calPanel.classList.add("hidden");
});

// Récupérer uniquement les événements de CE canal
async function loadChannelCalendar() {
  if (!currentChannel) return;
  const { data, error } = await supabaseClient
    .from("events")
    .select("*")
    .eq("channel_id", currentChannel.id);

  if (!error && data) {
    channelEvents = data;
  }
  renderMiniCalendar();
}

function renderMiniCalendar() {
  const miniGrid = document.getElementById("mini-calendar-days");
  if (!miniGrid) return;
  miniGrid.innerHTML = "";

  const year = currentCalDate.getFullYear();
  const month = currentCalDate.getMonth();

  document.getElementById("cal-panel-month").textContent = new Intl.DateTimeFormat("fr-FR", {
    month: "short",
    year: "numeric"
  }).format(currentCalDate);

  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement("div");
    empty.className = "mini-day-cell";
    empty.style.visibility = "hidden";
    miniGrid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement("div");
    cell.className = "mini-day-cell";
    cell.textContent = day;

    const formattedDay = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    // Indicateurs d'événements
    const dayEvs = channelEvents.filter(e => e.start_time.startsWith(formattedDay));
    if (dayEvs.some(e => e.category === "projet")) cell.classList.add("has-meeting");
    if (dayEvs.some(e => e.category === "occupe")) cell.classList.add("has-busy");

    if (selectedCalDay === formattedDay) cell.classList.add("selected");

    cell.addEventListener("click", () => {
      selectedCalDay = formattedDay;
      document.getElementById("panel-selected-date").value = formattedDay;
      document.getElementById("panel-selected-date-text").textContent = `${day}/${month + 1}`;
      renderMiniCalendar();
    });

    miniGrid.appendChild(cell);
  }
}

// Navigation mois
document.getElementById("cal-panel-prev")?.addEventListener("click", () => {
  currentCalDate.setMonth(currentCalDate.getMonth() - 1);
  renderMiniCalendar();
});

document.getElementById("cal-panel-next")?.addEventListener("click", () => {
  currentCalDate.setMonth(currentCalDate.getMonth() + 1);
  renderMiniCalendar();
});

// Enregistrer l'événement lié au salon
document.getElementById("panel-event-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const day = document.getElementById("panel-selected-date").value;
  if (!day) {
    alert("Veuillez sélectionner un jour sur le calendrier.");
    return;
  }

  const newEvent = {
    title: document.getElementById("panel-event-title").value,
    category: document.getElementById("panel-event-category").value,
    start_time: `${day}T${document.getElementById("panel-event-start").value}:00Z`,
    end_time: `${day}T${document.getElementById("panel-event-end").value}:00Z`,
    channel_id: currentChannel.id,
    user_id: currentUser.id
  };

  const { error } = await supabaseClient.from("events").insert(newEvent);
  if (!error) {
    document.getElementById("panel-event-title").value = "";
    loadChannelCalendar();
  } else {
    alert("Erreur : " + error.message);
  }
});
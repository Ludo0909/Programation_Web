let currentChannel = StorageService.readChannel();
let currentUser = null;
let unsubscribeMessages = null;

const inputChannel = document.getElementById("input-channel");
const inputMessage = document.getElementById("input-message");
const ulChannels = document.getElementById("ul-channels");
const divMessages = document.getElementById("div-messages");
const spanChannelTitle = document.getElementById("span-channel-title");
const headerAvatar = document.getElementById("header-avatar");
const chatPlaceholder = document.getElementById("chat-placeholder");
const chatContainer = document.getElementById("chat-container");

// Créer un salon (avec user id)
document.getElementById("form-channel")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = inputChannel.value.trim();
  if (!name || !currentUser) return;
  await ChatDatabase.createChannel(name, currentUser.id);
  inputChannel.value = "";
});

// Envoyer un message
document.getElementById("form-message")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const content = inputMessage.value.trim();
  if (!content || !currentChannel || !currentUser) return;

  const displayName = currentUser.user_metadata?.username || currentUser.email;

  const { error } = await ChatDatabase.sendMessage(
    currentChannel.id,
    content,
    displayName,
    currentUser.id
  );

  if (error) {
    console.error("Erreur d'envoi :", error.message);
    return;
  }
  inputMessage.value = "";
});

// Sécurité : redirection si session expirée (vers index.html)
AuthService.onSessionChange((event, session) => {
  if (event === "SIGNED_OUT" || !session) {
    StorageService.clearSession();
    window.location.replace("./index.html");
  }
});

// Salons (cartes de gauche avec classe .chat-card)
async function loadChannels() {
  const { data: channels, error } = await ChatDatabase.fetchChannels();
  if (error) return;

  ulChannels.replaceChildren();
  channels.forEach((channel) => {
    const card = document.createElement("div");
    card.className = "chat-card p-3 rounded bg-white d-flex align-items-center gap-3";
    
    if (currentChannel && channel.id === currentChannel.id) {
      card.classList.add("active");
    }

    const firstLetter = channel.name.charAt(0).toUpperCase();
    card.innerHTML = `
      <div class="avatar">${firstLetter}</div>
      <div class="overflow-hidden">
        <h6 class="mb-0 text-truncate font-weight-bold"># ${channel.name}</h6>
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

// Bulles de messages (.message, .incoming, .outgoing)
function displayMessage(message) {
  const isMine = currentUser && (message.created_by === currentUser.id);

  const msgDiv = document.createElement("div");
  msgDiv.className = `message ${isMine ? "outgoing" : "incoming"}`;

  const textP = document.createElement("p");
  textP.textContent = message.content;

  const timeSpan = document.createElement("span");
  timeSpan.className = "time";
  
  if (message.created_at) {
    const d = new Date(message.created_at);
    timeSpan.textContent = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')} - ${message.username || 'Anonyme'}`;
  }

  msgDiv.append(textP, timeSpan);
  divMessages.appendChild(msgDiv);
}

// Démarrage
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
    if (chatPlaceholder) chatPlaceholder.style.display = "none";
    if (chatContainer) chatContainer.classList.add("active");
    if (spanChannelTitle) spanChannelTitle.textContent = "# " + currentChannel.name;
    if (headerAvatar) headerAvatar.textContent = currentChannel.name.charAt(0).toUpperCase();

    unsubscribeMessages = ChatDatabase.subscribeToMessages(currentChannel.id, appendMessage);
    await loadMessages();
  }
}

init();
let currentChannel = StorageService.readChannel();
let currentUser = null;
let unsubscribeMessages = null;

// Éléments du DOM
const inputChannel = document.getElementById("input-channel");
const inputMessage = document.getElementById("input-message");
const ulChannels = document.getElementById("ul-channels");
const divMessages = document.getElementById("div-messages");
const spanChannelTitle = document.getElementById("span-channel-title");
const buttonSignout = document.getElementById("button-signout");

// --- ÉVÉNEMENTS ---

// Créer un salon
document.getElementById("form-channel")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = inputChannel.value.trim();
  if (!name) return;
  await ChatDatabase.createChannel(name);
  inputChannel.value = "";
});

// Envoyer un message
document.getElementById("form-message")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const content = inputMessage.value.trim();
  if (!content || !currentChannel || !currentUser) return;

  const { error } = await ChatDatabase.sendMessage(
    currentChannel.id,
    content,
    currentUser.email
  );

  if (error) {
    console.error("Erreur d'envoi :", error.message);
    return;
  }
  inputMessage.value = "";
});

// Bouton retour
document.getElementById("button-back")?.addEventListener("click", () => {
  if (unsubscribeMessages) unsubscribeMessages();
  unsubscribeMessages = null;
  divMessages.replaceChildren();
  StorageService.clearSession();
  currentChannel = null;
  document.body.classList.remove("open");
});

// Déconnexion
buttonSignout?.addEventListener("click", async () => {
  await AuthService.signOut();
  StorageService.clearSession();
  window.location.replace("./signin.html");
});

// Sécurité : redirection si session expirée
AuthService.onSessionChange((event, session) => {
  if (event === "SIGNED_OUT" || !session) {
    StorageService.clearSession();
    window.location.replace("./signin.html");
  }
});

// --- SALONS & MESSAGES ---

async function loadChannels() {
  const { data: channels, error } = await ChatDatabase.fetchChannels();
  if (error) return;

  ulChannels.replaceChildren();
  channels.forEach((channel) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.className = "channel-item";
    btn.textContent = `# ${channel.name}`;
    if (currentChannel && channel.id === currentChannel.id) {
      btn.setAttribute("aria-current", "true");
    }
    btn.onclick = () => selectChannel(btn, channel);
    li.appendChild(btn);
    ulChannels.appendChild(li);
  });
}

async function selectChannel(buttonElement, channel) {
  document.querySelectorAll(".channel-item").forEach((b) => b.removeAttribute("aria-current"));
  buttonElement.setAttribute("aria-current", "true");

  currentChannel = channel;
  StorageService.writeChannel(channel);
  spanChannelTitle.textContent = `# ${channel.name}`;
  document.body.classList.add("open");

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
  const article = document.createElement("article");
  if (currentUser && message.user_id === currentUser.id) {
    article.classList.add("sent");
  }

  const header = document.createElement("header");
  header.textContent = message.username;

  const p = document.createElement("p");
  p.textContent = message.content;

  const time = document.createElement("time");
  time.textContent = message.created_at ? message.created_at.slice(0, 19).replace("T", " ") : "";

  article.append(header, p, time);
  divMessages.appendChild(article);
}

// --- DÉMARRAGE ---
async function init() {
  const { user } = await AuthService.getUser();
  if (!user) {
    window.location.replace("./signin.html");
    return;
  }
  currentUser = user;

  await loadChannels();
  ChatDatabase.subscribeToChannels(() => loadChannels());

  if (currentChannel) {
    spanChannelTitle.textContent = `# ${currentChannel.name}`;
    document.body.classList.add("open");
    unsubscribeMessages = ChatDatabase.subscribeToMessages(currentChannel.id, appendMessage);
    await loadMessages();
  }
}

init();
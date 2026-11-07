let currentUser = null;
let activeRecipient = null;
let realtimeChannel = null;
let allUsers = [];

const searchUsersInput = document.getElementById("search-users");
const ulUsers = document.getElementById("ul-users");
const chatPlaceholder = document.getElementById("chat-placeholder");
const chatContainer = document.getElementById("chat-container");
const spanUserTitle = document.getElementById("span-user-title");
const headerAvatar = document.getElementById("header-avatar");
const divMessages = document.getElementById("div-messages");
const formDirectMessage = document.getElementById("form-direct-message");
const inputMessage = document.getElementById("input-message");
const chatCardsList = document.querySelector(".chat-cards-list");
const chatWindowCard = document.querySelector(".chat-window-card");
const btnMobileBack = document.getElementById("btn-mobile-back");

btnMobileBack?.addEventListener("click", () => {
  chatCardsList?.classList.remove("mobile-hidden");
  chatWindowCard?.classList.remove("mobile-active");
  document.querySelectorAll(".chat-card").forEach((c) => c.classList.remove("active"));
});

AuthService.onSessionChange((event, session) => {
  if (event === "SIGNED_OUT" || !session) {
    StorageService.clearSession();
    window.location.replace("./index.html");
  }
});

async function init() {
  const { user } = await AuthService.getUser();
  if (!user) {
    window.location.replace("./index.html");
    return;
  }
  currentUser = user;
  await loadUsers();
}

async function loadUsers() {
  let { data: users, error } = await supabaseClient
    .from("profiles")
    .select("id, username")
    .neq("id", currentUser.id);

  if (error || !users || users.length === 0) {
    const { data: pastMessages } = await supabaseClient
      .from("messages")
      .select("created_by, username");

    const uniqueMap = new Map();
    pastMessages?.forEach((m) => {
      if (m.created_by && m.created_by !== currentUser.id && !uniqueMap.has(m.created_by)) {
        uniqueMap.set(m.created_by, {
          id: m.created_by,
          username: m.username || "Membre"
        });
      }
    });
    users = Array.from(uniqueMap.values());
  }

  allUsers = users || [];
  renderUserList(allUsers);
}

function renderUserList(users) {
  if (!ulUsers) return;
  ulUsers.replaceChildren();

  if (users.length === 0) {
    ulUsers.innerHTML = '<div class="text-center text-muted small py-4">Aucun contact trouvé.</div>';
    return;
  }

  users.forEach((user) => {
    const card = document.createElement("div");
    card.className = "chat-card";
    card.setAttribute("data-id", user.id);

    if (activeRecipient && activeRecipient.id === user.id) {
      card.classList.add("active");
    }

    const firstLetter = (user.username || "U").charAt(0).toUpperCase();
    card.innerHTML = `
      <div class="avatar">${firstLetter}</div>
      <div class="overflow-hidden">
        <h6 class="mb-0 text-truncate fw-bold">${user.username || "Membre"}</h6>
        <small class="text-muted">Message privé</small>
      </div>
    `;

    card.onclick = () => selectRecipient(card, user);
    ulUsers.appendChild(card);
  });
}

searchUsersInput?.addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase();
  const filtered = allUsers.filter((u) =>
    (u.username || "").toLowerCase().includes(query)
  );
  renderUserList(filtered);
});

async function selectRecipient(cardElement, user) {
  document.querySelectorAll(".chat-card").forEach((c) => c.classList.remove("active"));
  cardElement.classList.add("active");

  activeRecipient = user;

  if (chatPlaceholder) chatPlaceholder.style.display = "none";
  if (chatContainer) chatContainer.classList.add("active");

  if (window.innerWidth <= 768) {
    chatCardsList?.classList.add("mobile-hidden");
    chatWindowCard?.classList.add("mobile-active");
  }

  if (spanUserTitle) spanUserTitle.textContent = user.username || "Membre";
  if (headerAvatar) headerAvatar.textContent = (user.username || "U").charAt(0).toUpperCase();

  subscribeToDirectMessages();
  await loadDirectMessages();
}

async function loadDirectMessages() {
  if (!activeRecipient || !currentUser || !divMessages) return;

  const { data: messages, error } = await supabaseClient
    .from("direct_messages")
    .select("*")
    .or(
      `and(sender_id.eq.${currentUser.id},receiver_id.eq.${activeRecipient.id}),and(sender_id.eq.${activeRecipient.id},receiver_id.eq.${currentUser.id})`
    )
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Erreur direct_messages :", error.message);
    return;
  }

  divMessages.replaceChildren();
  (messages || []).forEach((msg) => displayDirectMessage(msg));
  divMessages.scrollTop = divMessages.scrollHeight;
}

function subscribeToDirectMessages() {
  if (realtimeChannel) {
    supabaseClient.removeChannel(realtimeChannel);
  }

  realtimeChannel = supabaseClient
    .channel("direct_messages_sync")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "direct_messages" },
      (payload) => {
        const msg = payload.new;
        const isFromCurrentChat =
          (msg.sender_id === currentUser.id && msg.receiver_id === activeRecipient.id) ||
          (msg.sender_id === activeRecipient.id && msg.receiver_id === currentUser.id);

        if (isFromCurrentChat) {
          displayDirectMessage(msg);
          if (divMessages) divMessages.scrollTop = divMessages.scrollHeight;
        }
      }
    )
    .subscribe();
}

function displayDirectMessage(msg) {
  if (!divMessages) return;

  const isMine = currentUser && msg.sender_id === currentUser.id;

  const msgDiv = document.createElement("div");
  msgDiv.className = `message ${isMine ? "outgoing" : "incoming"}`;

  const textP = document.createElement("p");
  textP.textContent = msg.content;

  const timeSpan = document.createElement("span");
  timeSpan.className = "time";

  const d = msg.created_at ? new Date(msg.created_at) : new Date();
  const timeFormatted = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  timeSpan.textContent = isMine
    ? timeFormatted
    : `${timeFormatted} · ${msg.sender_username || activeRecipient.username || "Contact"}`;

  msgDiv.append(textP, timeSpan);
  divMessages.appendChild(msgDiv);
}

formDirectMessage?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const content = inputMessage.value.trim();
  if (!content || !activeRecipient || !currentUser) return;

  const myUsername =
    currentUser.user_metadata?.username ||
    currentUser.user_metadata?.full_name ||
    currentUser.email.split("@")[0];

  inputMessage.value = "";

  const newDirectMsg = {
    sender_id: currentUser.id,
    receiver_id: activeRecipient.id,
    sender_username: myUsername,
    content: content
  };

  const { error } = await supabaseClient
    .from("direct_messages")
    .insert(newDirectMsg);

  if (error) {
    console.error("Erreur envoi MP :", error.message);
  }
});

init();

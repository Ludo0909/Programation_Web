let currentUser = null;
let activeRecipient = null;
let realtimeChannel = null;

const usersListContainer = document.getElementById("users-list");
const dmContainer = document.getElementById("dm-container");
const dmPlaceholder = document.getElementById("dm-placeholder");
const dmMessages = document.getElementById("dm-messages");
const dmForm = document.getElementById("dm-form");
const dmInput = document.getElementById("dm-input");
const dmRecipientName = document.getElementById("dm-recipient-name");
const dmAvatar = document.getElementById("dm-avatar");

async function init() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    window.location.replace("./index.html");
    return;
  }
  currentUser = user;

  await loadContacts();
  setupRealtime();
}

// 1. Récupérer les membres avec qui discuter
async function loadContacts() {
  // Option A : récupérer depuis une table 'profiles' si elle existe
  // Option B : récupérer les pseudos distincts ayant déjà écrit sur la plateforme
  const { data: messages } = await supabaseClient
    .from("messages")
    .select("created_by, username");

  const contactsMap = new Map();
  if (messages) {
    messages.forEach(m => {
      if (m.created_by && m.created_by !== currentUser.id) {
        contactsMap.set(m.created_by, m.username || "Membre");
      }
    });
  }

  renderContacts(Array.from(contactsMap.entries()));
}

function renderContacts(contacts) {
  usersListContainer.replaceChildren();

  if (contacts.length === 0) {
    usersListContainer.innerHTML = '<div class="text-center text-muted small py-4">Aucun membre trouvé.</div>';
    return;
  }

  contacts.forEach(([userId, username]) => {
    const card = document.createElement("div");
    card.className = "chat-card";
    card.innerHTML = `
      <div class="avatar">${username.charAt(0).toUpperCase()}</div>
      <div class="overflow-hidden">
        <h6 class="mb-0 text-truncate fw-bold">${username}</h6>
        <small class="text-muted">Message direct</small>
      </div>
    `;

    card.onclick = () => selectRecipient(userId, username, card);
    usersListContainer.appendChild(card);
  });
}

// 2. Sélectionner un destinataire
async function selectRecipient(userId, username, cardElement) {
  document.querySelectorAll(".chat-card").forEach(c => c.classList.remove("active"));
  cardElement?.classList.add("active");

  activeRecipient = { id: userId, username };
  dmRecipientName.textContent = username;
  dmAvatar.textContent = username.charAt(0).toUpperCase();

  dmPlaceholder.style.display = "none";
  dmContainer.style.display = "flex";

  await loadConversation();
}

// 3. Charger l'historique privé entre les deux personnes
async function loadConversation() {
  if (!activeRecipient) return;

  const { data: msgs, error } = await supabaseClient
    .from("direct_messages")
    .select("*")
    .or(
      `and(sender_id.eq.${currentUser.id},receiver_id.eq.${activeRecipient.id}),and(sender_id.eq.${activeRecipient.id},receiver_id.eq.${currentUser.id})`
    )
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Erreur chargement MP :", error.message);
    return;
  }

  dmMessages.replaceChildren();
  msgs.forEach(msg => displayDmMessage(msg));
  dmMessages.scrollTop = dmMessages.scrollHeight;
}

function displayDmMessage(msg) {
  const isMine = msg.sender_id === currentUser.id;
  const msgDiv = document.createElement("div");
  msgDiv.className = `message ${isMine ? "outgoing" : "incoming"}`;

  const textP = document.createElement("p");
  textP.textContent = msg.content;

  const timeSpan = document.createElement("span");
  timeSpan.className = "time";
  const d = new Date(msg.created_at);
  timeSpan.textContent = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

  msgDiv.append(textP, timeSpan);
  dmMessages.appendChild(msgDiv);
}

// 4. Envoi de message privé
dmForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = dmInput.value.trim();
  if (!text || !activeRecipient) return;

  dmInput.value = "";
  const myPseudo = currentUser.user_metadata?.username || currentUser.email.split("@")[0];

  const { data, error } = await supabaseClient
    .from("direct_messages")
    .insert({
      sender_id: currentUser.id,
      receiver_id: activeRecipient.id,
      sender_username: myPseudo,
      content: text
    })
    .select()
    .single();

  if (error) {
    alert("Erreur d'envoi : " + error.message);
  } else if (data) {
    displayDmMessage(data);
    dmMessages.scrollTop = dmMessages.scrollHeight;
  }
});

// 5. Écoute en temps réel
function setupRealtime() {
  realtimeChannel = supabaseClient
    .channel("dm-listener")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "direct_messages" },
      payload => {
        const newMsg = payload.new;
        // Afficher seulement si la discussion ouverte correspond à l'expéditeur
        if (activeRecipient && newMsg.sender_id === activeRecipient.id && newMsg.receiver_id === currentUser.id) {
          displayDmMessage(newMsg);
          dmMessages.scrollTop = dmMessages.scrollHeight;
        }
      }
    )
    .subscribe();
}

init();
(function () {
    "use strict";

    const $ = (id) => document.getElementById(id);

    const page = $("contacts-page");
    const searchInput = $("search-contacts");
    const list = $("contact-list");
    const emptyState = $("empty-state");
    const count = $("contact-count");

    let currentUser = null;
    let allUsers = [];

    function initials(name) {
        const clean = (name || "").trim();
        return clean.length > 0 ? clean.charAt(0).toUpperCase() : "?";
    }

    function render() {
        const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
        const visible = allUsers.filter((u) =>
            (u.username || "").toLowerCase().includes(query)
        );

        if (count) count.textContent = allUsers.length;
        if (!list) return;

        if (allUsers.length === 0) {
            list.innerHTML = "";
            if (emptyState) {
                emptyState.textContent = "Aucun membre trouvé dans les messages.";
                emptyState.hidden = false;
            }
            return;
        }

        if (visible.length === 0) {
            list.innerHTML = "";
            if (emptyState) {
                emptyState.textContent = "Aucun membre ne correspond à votre recherche.";
                emptyState.hidden = false;
            }
            return;
        }

        if (emptyState) emptyState.hidden = true;

        list.innerHTML = visible.map((user) => {
            const name = user.username || "Membre";
            const initial = initials(name);
            const userUrl = `message_prive.html?user_id=${user.id}&username=${encodeURIComponent(name)}`;

            return `
                <li class="contact-item">
                    <div class="contact-avatar" aria-hidden="true">${initial}</div>
                    <div class="contact-info">
                        <div class="contact-name">${name}</div>
                        <div class="contact-username">@${name.toLowerCase().replace(/\\s+/g, "_")}</div>
                    </div>
                    <div class="contact-actions">
                        <a href="${userUrl}" class="chat-btn" title="Envoyer un message privé">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                            </svg>
                            <span>Discuter</span>
                        </a>
                    </div>
                </li>
            `;
        }).join("");
    }

    searchInput?.addEventListener("input", render);

    async function loadUsersFromMessages() {
        try {
            const { data: pastMessages, error } = await supabaseClient
                .from("messages")
                .select("created_by, username");

            if (error) {
                console.error("Erreur messages:", error.message);
                return;
            }

            const uniqueMap = new Map();
            (pastMessages || []).forEach((m) => {
                const id = m.created_by;
                const username = m.username;
                if (id && id !== currentUser.id && !uniqueMap.has(id)) {
                    uniqueMap.set(id, {
                        id: id,
                        username: username && username.trim() !== "" ? username : "Membre"
                    });
                }
            });

            allUsers = Array.from(uniqueMap.values());
            allUsers.sort((a, b) => (a.username || "").localeCompare(b.username || "", "fr", { sensitivity: "base" }));
            render();
        } catch (err) {
            console.error("Erreur chargement:", err);
        }
    }

    async function init() {
        const { user } = await AuthService.getUser();
        if (!user) {
            window.location.replace("index.html");
            return;
        }
        currentUser = user;

        AuthService.onSessionChange((evt, session) => {
            if (evt === "SIGNED_OUT" || !session) {
                StorageService.clearSession();
                window.location.replace("index.html");
            }
        });

        if (page) page.hidden = false;
        await loadUsersFromMessages();
    }

    init();
})();
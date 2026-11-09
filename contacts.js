
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
        const parts = (name || "").trim().split(/\s+/).filter(Boolean);
        if (parts.length === 0) return "?";
        const first = parts[0][0];
        const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
        return (first + last).toUpperCase();
    }

    function svgIcon(paths) {
        const ns = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(ns, "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "2");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");
        svg.setAttribute("aria-hidden", "true");
        const path = document.createElementNS(ns, "path");
        path.setAttribute("d", d);
        svg.appendChild(path);
        return svg;
    }

    function render() {
        const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
        const visible = allUsers.filter((u) =>
            (u.username || "").toLowerCase().includes(query)
        );

        if (count) count.textContent = allUsers.length;

        if (!list) {
            console.error("Élément #contact-list introuvable dans le DOM");
            return;
        }

        // Si aucun utilisateur n'est trouvé
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

        // Génération propre en direct
        list.innerHTML = visible.map((user) => {
            const displayName = user.username || "Membre";
            const initial = initials(displayName);
            const userUrl = `message_prive.html?user_id=${user.id}&username=${encodeURIComponent(displayName)}`;

            return `
                <li class="contact-item" style="display: flex !important; visibility: visible !important; opacity: 1 !important;">
                    <div class="contact-avatar" aria-hidden="true">${initial}</div>
                    <div class="contact-info">
                        <div class="contact-name">${displayName}</div>
                        <div class="contact-username">Membre actif</div>
                    </div>
                    <div class="contact-actions">
                        <a href="${userUrl}" class="icon-btn" title="Envoyer un message privé" aria-label="Envoyer un message à ${displayName}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:17px;height:17px;">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                            </svg>
                        </a>
                    </div>
                </li>
            `;
        }).join("");
    }

    searchInput?.addEventListener("input", () => render());

    async function loadUsersFromMessages() {
        const { data: pastMessages, error } = await supabaseClient
            .from("messages")
            .select("created_by, username");

        if (error || !pastMessages) {
            console.error("Erreur chargement membres:", error?.message);
            return;
        }

        const uniqueMap = new Map();
        pastMessages.forEach((m) => {
            if (m.created_by && m.created_by !== currentUser.id && !uniqueMap.has(m.created_by)) {
                uniqueMap.set(m.created_by, {
                    id: m.created_by,
                    username: m.username || "Membre"
                });
            }
        });

        allUsers = Array.from(uniqueMap.values());
        allUsers.sort((a, b) => (a.username || "").localeCompare(b.username || "", "fr", { sensitivity: "base" }));
        render();
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
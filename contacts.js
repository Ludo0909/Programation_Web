(function () {
    "use strict";

    const $ = (id) => document.getElementById(id);

    const page = $("contacts-page");
    const pageNotice = $("page-message");
    const searchInput = $("search-contacts");
    const list = $("contact-list");
    const emptyState = $("empty-state");
    const count = $("contact-count");

    let currentUser = null;
    let allUsers = [];

    function notify(element, text, type) {
        if (!element) return;
        element.textContent = text;
        element.className = "notice show " + type;
    }

    function initials(name) {
        const parts = (name || "").trim().split(/\s+/).filter(Boolean);
        if (parts.length === 0) return "?";
        const first = parts[0][0];
        const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
        return (first + last).toUpperCase();
    }

    function displayName(contact) {
        return contact.full_name || contact.username || "Membre";
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
        paths.forEach((d) => {
            const path = document.createElementNS(ns, "path");
            path.setAttribute("d", d);
            svg.appendChild(path);
        });
        return svg;
    }

    function render() {
        const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
        const visible = allUsers.filter((c) =>
            (c.username || "").toLowerCase().includes(query) ||
            (c.full_name || "").toLowerCase().includes(query)
        );

        if (count) count.textContent = allUsers.length;
        list.replaceChildren();

        visible.forEach((contact) => {
            const item = document.createElement("li");
            item.className = "contact-item";

            const avatar = document.createElement("div");
            avatar.className = "contact-avatar";
            avatar.setAttribute("aria-hidden", "true");
            avatar.textContent = initials(displayName(contact));

            const info = document.createElement("div");
            info.className = "contact-info";
            const name = document.createElement("div");
            name.className = "contact-name";
            name.textContent = displayName(contact);
            const username = document.createElement("div");
            username.className = "contact-username";
            username.textContent = "@" + (contact.username || "membre");
            info.append(name, username);

            const actions = document.createElement("div");
            actions.className = "contact-actions";

            const messageLink = document.createElement("a");
            messageLink.className = "icon-btn";
            messageLink.href = `message_prive.html?user_id=${contact.id}&username=${encodeURIComponent(contact.username || displayName(contact))}`;
            messageLink.title = "Envoyer un message privé";
            messageLink.setAttribute("aria-label", "Envoyer un message privé à " + displayName(contact));
            messageLink.appendChild(svgIcon(["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"]));

            actions.append(messageLink);
            item.append(avatar, info, actions);
            list.appendChild(item);
        });

        if (allUsers.length === 0) {
            emptyState.textContent = "Aucun utilisateur trouvé sur la plateforme.";
            emptyState.hidden = false;
        } else if (visible.length === 0) {
            emptyState.textContent = "Aucun utilisateur ne correspond à votre recherche.";
            emptyState.hidden = false;
        } else {
            emptyState.hidden = true;
        }
    }

    searchInput?.addEventListener("input", () => render());

    async function loadAllPlatformUsers() {
        let { data: profiles, error } = await supabaseClient
            .from("profiles")
            .select("id, username, full_name")
            .neq("id", currentUser.id);

        if (error || !profiles || profiles.length === 0) {
            const { data: pastMessages } = await supabaseClient
                .from("messages")
                .select("created_by, username");

            const uniqueMap = new Map();
            pastMessages?.forEach((m) => {
                if (m.created_by && m.created_by !== currentUser.id && !uniqueMap.has(m.created_by)) {
                    uniqueMap.set(m.created_by, {
                        id: m.created_by,
                        username: m.username || "Membre",
                        full_name: m.username || "Membre"
                    });
                }
            });
            profiles = Array.from(uniqueMap.values());
        }

        allUsers = profiles || [];
        allUsers.sort((a, b) => displayName(a).localeCompare(displayName(b), "fr", { sensitivity: "base" }));
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
        await loadAllPlatformUsers();
    }
    init();
})();
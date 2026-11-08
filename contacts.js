// ===== Page contacts =====

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
    let members = [];

    // ---------- Utilitaires ----------

    function notify(element, text, type) {
        element.textContent = text;
        element.className = "notice show " + type;
    }

    function initials(name) {
        const parts = (name || "").trim().split(/\s+/).filter(Boolean);
        if (parts.length === 0) {
            return "?";
        }
        const first = parts[0][0];
        const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
        return (first + last).toUpperCase();
    }

    function displayName(member) {
        return member.full_name || member.username || "Membre";
    }

    function isMissingTable(error) {
        return error && (error.code === "PGRST205" || /could not find the table/i.test(error.message));
    }

    function svgIcon(d) {
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

    // ---------- Affichage ----------

    function render() {
        const query = searchInput.value.trim().replace(/^@/, "").toLowerCase();
        const visible = members.filter((m) => (m.username || "").toLowerCase().includes(query));

        count.textContent = members.length;
        list.replaceChildren();

        visible.forEach((member) => {
            const item = document.createElement("li");
            item.className = "contact-item";

            const avatar = document.createElement("div");
            avatar.className = "contact-avatar";
            avatar.setAttribute("aria-hidden", "true");
            avatar.textContent = initials(displayName(member));

            const info = document.createElement("div");
            info.className = "contact-info";
            const name = document.createElement("div");
            name.className = "contact-name";
            name.textContent = displayName(member);
            const username = document.createElement("div");
            username.className = "contact-username";
            username.textContent = "@" + (member.username || "inconnu");
            info.append(name, username);

            const chatLink = document.createElement("a");
            chatLink.className = "chat-btn";
            chatLink.href = "message_prive.html?user=" + encodeURIComponent(member.id);
            chatLink.setAttribute("aria-label", "Discuter avec " + displayName(member));
            chatLink.append(svgIcon("M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"), "Discuter");

            item.append(avatar, info, chatLink);
            list.appendChild(item);
        });

        if (members.length === 0) {
            emptyState.textContent = "Aucun autre membre n'est encore inscrit sur WorkFlow.";
            emptyState.hidden = false;
        } else if (visible.length === 0) {
            emptyState.textContent = "Aucun nom d'utilisateur ne correspond à « " + searchInput.value.trim() + " ».";
            emptyState.hidden = false;
        } else {
            emptyState.hidden = true;
        }
    }

    searchInput.addEventListener("input", render);

    // ---------- Chargement ----------

    async function loadMembers() {
        const { data, error } = await supabaseClient
            .from("profiles")
            .select("id, username, full_name")
            .neq("id", currentUser.id);

        if (error) {
            if (isMissingTable(error)) {
                notify(
                    pageNotice,
                    "La base de données n'est pas encore prête : exécutez le fichier supabase/profiles.sql " +
                    "dans l'éditeur SQL de Supabase, puis rechargez la page.",
                    "fail"
                );
            } else {
                notify(pageNotice, "Impossible de charger les membres : " + error.message, "fail");
            }
            return;
        }

        members = (data || []).sort((a, b) =>
            (a.username || "").localeCompare(b.username || "", "fr", { sensitivity: "base" })
        );
        render();
    }

    // ---------- Démarrage ----------

    function supabaseReady() {
        try {
            return Boolean(AuthService && StorageService && supabaseClient);
        } catch (e) {
            return false;
        }
    }

    async function init() {
        if (!supabaseReady()) {
            page.hidden = false;
            notify(pageNotice, "Le service de connexion n'a pas pu être chargé. Vérifiez votre connexion et rechargez la page.", "fail");
            return;
        }

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

        page.hidden = false;
        await loadMembers();
    }

    init();
})();

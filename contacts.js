// ===== Page contacts (Supabase) =====
// Dépend de :
//   - supabase-service.js : AuthService, StorageService, supabaseClient
//   - script.js : setError
// Tables utilisées (voir supabase/contacts.sql) :
//   - profiles : id, username, full_name (copie publique des métadonnées de chaque compte)
//   - contacts : owner_id, contact_id (un collègue ajouté par l'utilisateur connecté)
// Tout est dans une fonction pour ne pas entrer en conflit avec les variables des autres scripts.

(function () {
    "use strict";

    const $ = (id) => document.getElementById(id);

    const page = $("contacts-page");
    const pageNotice = $("page-message");

    const addForm = $("add-form");
    const addInput = $("add-username");
    const addBtn = $("add-btn");
    const addNotice = $("add-message");

    const searchInput = $("search-contacts");
    const list = $("contact-list");
    const emptyState = $("empty-state");
    const count = $("contact-count");

    let currentUser = null;
    let contacts = []; // [{ id, username, full_name }]

    // ---------- Utilitaires ----------

    // Même rôle que notify() de profil.js
    function notify(element, text, type) {
        element.textContent = text;
        element.className = "notice show " + type;
    }

    function clearNotice(element) {
        element.className = "notice";
        element.textContent = "";
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

    function displayName(contact) {
        return contact.full_name || contact.username || "Membre";
    }

    // Dans un filtre « ilike », % et _ sont des jokers : on les échappe
    function escapeLike(text) {
        return text.replace(/[\\%_]/g, "\\$&");
    }

    // La table n'existe pas encore dans Supabase (script SQL pas encore exécuté)
    function isMissingTable(error) {
        return error && (error.code === "PGRST205" || /could not find the table/i.test(error.message));
    }

    function showSetupNeeded() {
        notify(
            pageNotice,
            "La base de données n'est pas encore prête pour les contacts : exécutez le fichier " +
            "supabase/contacts.sql dans l'éditeur SQL de Supabase, puis rechargez la page.",
            "fail"
        );
    }

    // Désactive un bouton pendant un appel réseau
    async function withBusy(button, busyText, task) {
        const label = button.textContent;
        button.disabled = true;
        button.textContent = busyText;
        try {
            return await task();
        } finally {
            button.disabled = false;
            button.textContent = label;
        }
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

    // ---------- Affichage ----------

    function render(highlightId) {
        const query = searchInput.value.trim().toLowerCase();
        const visible = contacts.filter((c) =>
            (c.username || "").toLowerCase().includes(query) ||
            (c.full_name || "").toLowerCase().includes(query)
        );

        count.textContent = contacts.length;
        list.replaceChildren();

        visible.forEach((contact) => {
            const item = document.createElement("li");
            item.className = "contact-item";
            if (contact.id === highlightId) {
                item.classList.add("is-new");
            }

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
            username.textContent = "@" + (contact.username || "inconnu");
            info.append(name, username);

            const actions = document.createElement("div");
            actions.className = "contact-actions";

            const messageLink = document.createElement("a");
            messageLink.className = "icon-btn";
            messageLink.href = "message_prive.html";
            messageLink.title = "Envoyer un message";
            messageLink.setAttribute("aria-label", "Envoyer un message à " + displayName(contact));
            messageLink.appendChild(svgIcon(["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"]));

            const removeBtn = document.createElement("button");
            removeBtn.type = "button";
            removeBtn.className = "icon-btn danger";
            removeBtn.title = "Retirer des contacts";
            removeBtn.setAttribute("aria-label", "Retirer " + displayName(contact) + " des contacts");
            removeBtn.appendChild(svgIcon(["M3 6h18", "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6", "M10 11v6", "M14 11v6", "M9 6V4h6v2"]));
            removeBtn.addEventListener("click", () => removeContact(contact));

            actions.append(messageLink, removeBtn);
            item.append(avatar, info, actions);
            list.appendChild(item);
        });

        if (contacts.length === 0) {
            emptyState.textContent = "Vous n'avez pas encore de contacts. Ajoutez un collègue avec son nom d'utilisateur ci-dessus.";
            emptyState.hidden = false;
        } else if (visible.length === 0) {
            emptyState.textContent = "Aucun contact ne correspond à « " + searchInput.value.trim() + " ».";
            emptyState.hidden = false;
        } else {
            emptyState.hidden = true;
        }
    }

    function sortContacts() {
        contacts.sort((a, b) => displayName(a).localeCompare(displayName(b), "fr", { sensitivity: "base" }));
    }

    searchInput.addEventListener("input", () => render());

    // ---------- Chargement ----------

    async function loadContacts() {
        const { data, error } = await supabaseClient
            .from("contacts")
            .select("contact_id, profiles(id, username, full_name)");

        if (error) {
            if (isMissingTable(error)) {
                showSetupNeeded();
            } else {
                notify(pageNotice, "Impossible de charger vos contacts : " + error.message, "fail");
            }
            return false;
        }

        contacts = (data || [])
            .map((row) => row.profiles)
            .filter(Boolean);
        sortContacts();
        render();
        return true;
    }

    // ---------- Ajout ----------

    addInput.addEventListener("input", () => {
        setError(addInput, "");
        addInput.classList.remove("valid");
    });

    addForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearNotice(addNotice);

        // On accepte « @nom » ou « nom »
        const wanted = addInput.value.trim().replace(/^@/, "");

        if (wanted === "") {
            setError(addInput, "Veuillez entrer un nom d'utilisateur.");
            return;
        }

        const myUsername = (currentUser.user_metadata && currentUser.user_metadata.username) || "";
        if (wanted.toLowerCase() === myUsername.toLowerCase()) {
            setError(addInput, "Vous ne pouvez pas vous ajouter vous-même.");
            return;
        }

        if (contacts.some((c) => (c.username || "").toLowerCase() === wanted.toLowerCase())) {
            setError(addInput, "@" + wanted + " fait déjà partie de vos contacts.");
            return;
        }

        await withBusy(addBtn, "Ajout...", async () => {
            // Recherche insensible aux majuscules, mais sur le nom exact
            const { data: found, error: findError } = await supabaseClient
                .from("profiles")
                .select("id, username, full_name")
                .ilike("username", escapeLike(wanted))
                .neq("id", currentUser.id)
                .limit(2);

            if (findError) {
                if (isMissingTable(findError)) {
                    showSetupNeeded();
                } else {
                    notify(addNotice, "La recherche a échoué : " + findError.message, "fail");
                }
                return;
            }
            if (!found || found.length === 0) {
                setError(addInput, "Aucun membre n'a le nom d'utilisateur @" + wanted + ".");
                return;
            }
            if (found.length > 1) {
                setError(addInput, "Plusieurs comptes portent ce nom d'utilisateur. Vérifiez les majuscules.");
                return;
            }

            const profile = found[0];
            const { error: insertError } = await supabaseClient
                .from("contacts")
                .insert({ owner_id: currentUser.id, contact_id: profile.id });

            if (insertError) {
                if (insertError.code === "23505") {
                    setError(addInput, "@" + profile.username + " fait déjà partie de vos contacts.");
                } else {
                    notify(addNotice, "Impossible d'ajouter ce contact : " + insertError.message, "fail");
                }
                return;
            }

            contacts.push(profile);
            sortContacts();
            addForm.reset();
            setError(addInput, "");
            addInput.classList.remove("valid");
            searchInput.value = "";
            render(profile.id);
            notify(addNotice, displayName(profile) + " (@" + profile.username + ") a été ajouté à vos contacts.", "success");
        });
    });

    // ---------- Suppression ----------

    async function removeContact(contact) {
        if (!confirm("Retirer " + displayName(contact) + " de vos contacts ?")) {
            return;
        }
        clearNotice(addNotice);

        const { error } = await supabaseClient
            .from("contacts")
            .delete()
            .eq("owner_id", currentUser.id)
            .eq("contact_id", contact.id);

        if (error) {
            notify(pageNotice, "Impossible de retirer ce contact : " + error.message, "fail");
            return;
        }

        contacts = contacts.filter((c) => c.id !== contact.id);
        render();
        notify(pageNotice, displayName(contact) + " a été retiré de vos contacts.", "success");
    }

    // ---------- Démarrage ----------

    // Même vérification que profil.js : supabase-service.js a pu planter au chargement
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
        render();
        await loadContacts();
    }

    init();
})();

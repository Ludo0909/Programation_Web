// ===== Page profil (Supabase) =====
// Dépend de :
//   - supabase-service.js : AuthService, StorageService, supabaseClient
//   - script.js : setError, isPasswordStrong, updatePasswordRules, EMAIL_REGEX
//                 et le bouton Afficher/Masquer des mots de passe
// Les informations du profil sont les métadonnées de l'utilisateur Supabase
// (full_name, username, birthdate), comme à la création du compte.
// Tout est dans une fonction pour ne pas entrer en conflit avec les variables des autres scripts.

(function () {
    "use strict";

    const $ = (id) => document.getElementById(id);

    const page = $("profile");
    const avatar = $("avatar");
    const avatarInput = $("avatar-input");
    const avatarRemove = $("avatar-remove");
    const heroName = $("hero-name");
    const heroUsername = $("hero-username");
    const heroEmail = $("hero-email");
    const heroBirth = $("hero-birth");
    const heroNotice = $("hero-message");

    const infoForm = $("info-form");
    const infoNotice = $("info-message");
    const infoActions = $("info-actions");
    const editBtn = $("edit-btn");
    const cancelBtn = $("cancel-btn");
    const saveBtn = infoActions.querySelector("button[type=submit]");
    const fullname = $("p-fullname");
    const username = $("p-username");
    const email = $("p-email");
    const birthdate = $("p-birthdate");
    const infoInputs = [fullname, username, email, birthdate];

    const passwordForm = $("password-form");
    const pwNotice = $("pw-message");
    const pwCurrent = $("pw-current");
    const pwNew = $("pw-new");
    const pwConfirm = $("pw-confirm");
    const pwRules = $("pw-rules");
    const pwSubmit = passwordForm.querySelector("button[type=submit]");

    let currentUser = null;

    // ---------- Utilitaires ----------

    // Même rôle que showMessage() de script.js, mais avec la classe .notice
    // (la classe .message est utilisée par le chat dans style.css).
    function notify(element, text, type) {
        element.textContent = text;
        element.className = "notice show " + type;
    }

    function clearNotice(element) {
        element.className = "notice";
        element.textContent = "";
    }

    function meta() {
        return (currentUser && currentUser.user_metadata) || {};
    }

    function displayFullname() {
        return meta().full_name || meta().username || currentUser.email.split("@")[0];
    }

    function displayUsername() {
        return meta().username || currentUser.email.split("@")[0];
    }

    function initials(name) {
        const parts = name.trim().split(/\s+/).filter(Boolean);
        if (parts.length === 0) {
            return "?";
        }
        const first = parts[0][0];
        const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
        return (first + last).toUpperCase();
    }

    function calcAge(iso) {
        const birth = new Date(iso + "T00:00:00");
        const today = new Date();
        const age = today.getFullYear() - birth.getFullYear();
        const birthdayPassed =
            today.getMonth() > birth.getMonth() ||
            (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
        return birthdayPassed ? age : age - 1;
    }

    function formatDate(iso) {
        return new Date(iso + "T00:00:00").toLocaleDateString("fr-CA", {
            year: "numeric",
            month: "long",
            day: "numeric"
        });
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

    // ---------- Photo de profil ----------
    // La photo reste sur cet appareil (localStorage) : les métadonnées Supabase sont
    // copiées dans le jeton de connexion, une image les alourdirait beaucoup.

    function avatarKey() {
        return "workflow_avatar_" + currentUser.id;
    }

    function getAvatar() {
        try {
            return localStorage.getItem(avatarKey()) || "";
        } catch (e) {
            return "";
        }
    }

    function setAvatar(dataUrl) {
        try {
            if (dataUrl) {
                localStorage.setItem(avatarKey(), dataUrl);
            } else {
                localStorage.removeItem(avatarKey());
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    // ---------- Affichage ----------

    function render() {
        heroName.textContent = displayFullname();
        heroUsername.textContent = "@" + displayUsername();
        heroEmail.textContent = currentUser.email;
        heroBirth.textContent = meta().birthdate
            ? formatDate(meta().birthdate) + " (" + calcAge(meta().birthdate) + " ans)"
            : "Date de naissance non renseignée";

        const photo = getAvatar();
        avatar.textContent = "";
        if (photo) {
            const img = document.createElement("img");
            img.src = photo;
            img.alt = "";
            avatar.appendChild(img);
        } else {
            avatar.textContent = initials(displayFullname());
        }
        avatarRemove.hidden = !photo;

        fullname.value = meta().full_name || "";
        username.value = meta().username || "";
        email.value = currentUser.email;
        birthdate.value = meta().birthdate || "";
    }

    avatarInput.addEventListener("change", () => {
        const file = avatarInput.files[0];
        avatarInput.value = "";
        clearNotice(heroNotice);

        if (!file) {
            return;
        }
        if (!file.type.startsWith("image/")) {
            notify(heroNotice, "Veuillez choisir un fichier image (JPG, PNG, WebP...).", "fail");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            notify(heroNotice, "L'image ne doit pas dépasser 5 Mo.", "fail");
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                // Recadre au carré et réduit à 256 px pour économiser le localStorage
                const size = 256;
                const side = Math.min(img.width, img.height);
                const canvas = document.createElement("canvas");
                canvas.width = size;
                canvas.height = size;
                canvas.getContext("2d").drawImage(
                    img,
                    (img.width - side) / 2, (img.height - side) / 2, side, side,
                    0, 0, size, size
                );

                if (setAvatar(canvas.toDataURL("image/jpeg", 0.85))) {
                    render();
                    notify(heroNotice, "Photo de profil mise à jour sur cet appareil.", "success");
                } else {
                    notify(heroNotice, "Impossible d'enregistrer la photo (espace de stockage plein).", "fail");
                }
            };
            img.onerror = () => notify(heroNotice, "Cette image n'a pas pu être lue.", "fail");
            img.src = reader.result;
        };
        reader.onerror = () => notify(heroNotice, "Le fichier n'a pas pu être lu.", "fail");
        reader.readAsDataURL(file);
    });

    avatarRemove.addEventListener("click", () => {
        clearNotice(heroNotice);
        setAvatar("");
        render();
        notify(heroNotice, "Photo de profil retirée.", "success");
    });

    // ---------- Informations personnelles ----------

    // Empêche de choisir une date dans le futur
    birthdate.max = new Date().toISOString().split("T")[0];

    function validateFullname() {
        if (fullname.value.trim().length < 2) {
            return setError(fullname, "Veuillez entrer votre nom complet.");
        }
        return setError(fullname, "");
    }

    function validateUsername() {
        if (!/^[A-Za-z0-9_.-]{3,20}$/.test(username.value.trim())) {
            return setError(username, "3 à 20 caractères : lettres, chiffres, . _ -");
        }
        return setError(username, "");
    }

    function validateEmail() {
        if (!EMAIL_REGEX.test(email.value.trim())) {
            return setError(email, "Adresse courriel invalide.");
        }
        return setError(email, "");
    }

    // Facultative : les comptes plus anciens n'ont pas forcément de date de naissance
    function validateBirthdate() {
        if (birthdate.value && calcAge(birthdate.value) < 13) {
            return setError(birthdate, "Vous devez avoir au moins 13 ans.");
        }
        return setError(birthdate, "");
    }

    function setEditing(on) {
        infoInputs.forEach((input) => {
            input.disabled = !on;
            input.classList.remove("valid", "invalid");
            const error = $(input.id + "-error");
            if (error) {
                error.textContent = "";
            }
        });
        editBtn.hidden = on;
        infoActions.hidden = !on;
        if (on) {
            clearNotice(infoNotice);
            fullname.focus();
        }
    }

    editBtn.addEventListener("click", () => setEditing(true));

    cancelBtn.addEventListener("click", () => {
        render(); // remet les valeurs enregistrées
        setEditing(false);
    });

    fullname.addEventListener("blur", validateFullname);
    username.addEventListener("blur", validateUsername);
    email.addEventListener("blur", validateEmail);
    birthdate.addEventListener("change", validateBirthdate);

    infoForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (infoActions.hidden) {
            return;
        }

        const results = [validateFullname(), validateUsername(), validateEmail(), validateBirthdate()];
        if (results.includes(false)) {
            notify(infoNotice, "Veuillez corriger les champs en rouge.", "fail");
            return;
        }

        const newEmail = email.value.trim().toLowerCase();
        const emailChanged = newEmail !== currentUser.email.toLowerCase();

        const changes = {
            data: {
                full_name: fullname.value.trim(),
                username: username.value.trim(),
                birthdate: birthdate.value
            }
        };
        if (emailChanged) {
            changes.email = newEmail;
        }

        clearNotice(infoNotice);
        const { data, error } = await withBusy(saveBtn, "Enregistrement...", () =>
            supabaseClient.auth.updateUser(changes)
        );

        if (error) {
            notify(infoNotice, "Impossible d'enregistrer : " + error.message, "fail");
            return;
        }

        currentUser = data.user;
        render(); // le courriel affiché reste l'ancien tant que le nouveau n'est pas confirmé
        setEditing(false);

        if (emailChanged) {
            notify(
                infoNotice,
                "Informations enregistrées. Un courriel de confirmation a été envoyé à " + newEmail +
                " : votre adresse changera une fois le lien ouvert.",
                "info"
            );
        } else {
            notify(infoNotice, "Vos informations ont été enregistrées.", "success");
        }
    });

    // ---------- Mot de passe ----------

    function validatePwConfirm() {
        if (pwConfirm.value === "" || pwConfirm.value !== pwNew.value) {
            return setError(pwConfirm, "Les mots de passe ne correspondent pas.");
        }
        return setError(pwConfirm, "");
    }

    function resetPasswordForm() {
        passwordForm.reset();
        [pwCurrent, pwNew, pwConfirm].forEach((input) => {
            input.classList.remove("valid", "invalid");
            input.type = "password";
        });
        passwordForm.querySelectorAll(".toggle-password").forEach((b) => (b.textContent = "Afficher"));
        passwordForm.querySelectorAll(".error").forEach((e) => (e.textContent = ""));
        updatePasswordRules(pwNew, pwRules);
    }

    pwNew.addEventListener("input", () => {
        updatePasswordRules(pwNew, pwRules);
        if (pwConfirm.value !== "") {
            validatePwConfirm();
        }
    });
    pwConfirm.addEventListener("input", validatePwConfirm);

    passwordForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearNotice(pwNotice);

        const currentFilled = pwCurrent.value !== ""
            ? setError(pwCurrent, "")
            : setError(pwCurrent, "Veuillez entrer votre mot de passe actuel.");

        const newOk = isPasswordStrong(pwNew.value)
            ? setError(pwNew, "")
            : setError(pwNew, "Le mot de passe ne respecte pas tous les critères.");

        const confirmOk = validatePwConfirm();

        if (!currentFilled || !newOk || !confirmOk) {
            return;
        }
        if (pwNew.value === pwCurrent.value) {
            setError(pwNew, "Le nouveau mot de passe doit être différent de l'actuel.");
            return;
        }

        await withBusy(pwSubmit, "Mise à jour...", async () => {
            // Vérifie le mot de passe actuel en rouvrant une session avec celui-ci
            const check = await supabaseClient.auth.signInWithPassword({
                email: currentUser.email,
                password: pwCurrent.value
            });
            if (check.error) {
                setError(pwCurrent, "Mot de passe actuel incorrect.");
                return;
            }

            const { error } = await supabaseClient.auth.updateUser({ password: pwNew.value });
            if (error) {
                notify(pwNotice, "Impossible de modifier le mot de passe : " + error.message, "fail");
                return;
            }

            resetPasswordForm();
            notify(pwNotice, "Votre mot de passe a été mis à jour.", "success");
        });
    });

    // ---------- Déconnexion ----------

    $("logout-btn").addEventListener("click", async () => {
        await AuthService.signOut();
        StorageService.clearSession();
        window.location.href = "index.html";
    });

    // ---------- Démarrage ----------

    // Si supabase-service.js a planté au chargement, ses variables restent inaccessibles
    // (même typeof lève une erreur) : on les teste dans un try/catch.
    function supabaseReady() {
        try {
            return Boolean(AuthService && StorageService && supabaseClient);
        } catch (e) {
            return false;
        }
    }

    async function init() {
        if (!supabaseReady()) {
            // Supabase n'a pas pu être chargé (réseau ou fichier manquant)
            page.hidden = false;
            notify(heroNotice, "Le service de connexion n'a pas pu être chargé. Vérifiez votre connexion et rechargez la page.", "fail");
            return;
        }

        const { user } = await AuthService.getUser();
        if (!user) {
            window.location.replace("index.html");
            return;
        }
        currentUser = user;

        // Même comportement que app.js : retour à la connexion si la session se termine
        AuthService.onSessionChange((evt, session) => {
            if (evt === "SIGNED_OUT" || !session) {
                StorageService.clearSession();
                window.location.replace("index.html");
            }
        });

        render();
        setEditing(false);
        page.hidden = false;
    }

    init();
})();

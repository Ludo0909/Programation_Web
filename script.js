// ===== Script commun : création de compte et mot de passe oublié =====
// Note : il n'y a pas encore de serveur. Les comptes sont gardés dans le
// localStorage du navigateur pour simuler une base de données.

// ---------- Fonctions utilitaires ----------

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PASSWORD_RULES = {
    length: (mdp) => mdp.length >= 8,
    upper: (mdp) => /[A-Z]/.test(mdp),
    lower: (mdp) => /[a-z]/.test(mdp),
    digit: (mdp) => /[0-9]/.test(mdp),
    special: (mdp) => /[^A-Za-z0-9]/.test(mdp)
};

function getAccounts() {
    try {
        return JSON.parse(localStorage.getItem("workflow_accounts")) || [];
    } catch (e) {
        return [];
    }
}

function saveAccounts(accounts) {
    try {
        localStorage.setItem("workflow_accounts", JSON.stringify(accounts));
    } catch (e) {
        // localStorage indisponible (navigation privée, etc.)
    }
}

// Affiche ou efface l'erreur d'un champ
function setError(input, message) {
    const errorElement = document.getElementById(input.id + "-error");
    if (errorElement) {
        errorElement.textContent = message;
    }
    input.classList.toggle("invalid", message !== "");
    input.classList.toggle("valid", message === "");
    return message === "";
}

function showMessage(element, text, type) {
    element.textContent = text;
    element.className = "message show " + type;
}

function isPasswordStrong(mdp) {
    return Object.values(PASSWORD_RULES).every((rule) => rule(mdp));
}

// Coche les critères respectés pendant que l'utilisateur tape
function updatePasswordRules(input, rulesList) {
    rulesList.querySelectorAll("li").forEach((li) => {
        const rule = PASSWORD_RULES[li.dataset.rule];
        li.classList.toggle("ok", rule(input.value));
    });
}

// Boutons « Afficher / Masquer » des mots de passe
document.querySelectorAll(".toggle-password").forEach((button) => {
    button.addEventListener("click", () => {
        const input = document.getElementById(button.dataset.target);
        const hidden = input.type === "password";
        input.type = hidden ? "text" : "password";
        button.textContent = hidden ? "Masquer" : "Afficher";
    });
});

// ---------- Page : connexion (index) ----------

const loginForm = document.getElementById("login-form");

if (loginForm) {
    const loginId = document.getElementById("login-id");
    const loginPassword = document.getElementById("login-password");
    const remember = document.getElementById("remember");
    const message = document.getElementById("login-message");

    // Remplit le champ si l'utilisateur a coché « Se souvenir de moi »
    try {
        const saved = localStorage.getItem("workflow_remember");
        if (saved) {
            loginId.value = saved;
            remember.checked = true;
        }
    } catch (e) {
        // localStorage indisponible
    }

    loginForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const idValue = loginId.value.trim().toLowerCase();
        const idOk = idValue === ""
            ? setError(loginId, "Veuillez entrer votre courriel ou nom d'utilisateur.")
            : setError(loginId, "");
        const passwordOk = loginPassword.value === ""
            ? setError(loginPassword, "Veuillez entrer votre mot de passe.")
            : setError(loginPassword, "");

        if (!idOk || !passwordOk) {
            return;
        }

        const account = getAccounts().find(
            (a) => a.email === idValue || a.username.toLowerCase() === idValue
        );

        // Même message dans les deux cas pour ne pas révéler si le compte existe
        if (!account || account.password !== loginPassword.value) {
            loginId.classList.add("invalid");
            loginPassword.classList.add("invalid");
            showMessage(message, "Courriel, nom d'utilisateur ou mot de passe incorrect.", "fail");
            return;
        }

        try {
            if (remember.checked) {
                localStorage.setItem("workflow_remember", loginId.value.trim());
            } else {
                localStorage.removeItem("workflow_remember");
            }
            sessionStorage.setItem("workflow_user", account.username);
        } catch (e) {
            // localStorage indisponible
        }

        showMessage(message, "Bienvenue " + account.fullname + " ! Connexion en cours...", "success");
        setTimeout(() => {
            window.location.href = "Lou/home.html";
        }, 1500);
    });
}

// ---------- Page : création de compte ----------

const signupForm = document.getElementById("signup-form");

if (signupForm) {
    const fullname = document.getElementById("fullname");
    const username = document.getElementById("username");
    const email = document.getElementById("email");
    const birthdate = document.getElementById("birthdate");
    const password = document.getElementById("password");
    const confirm = document.getElementById("confirm");
    const rulesList = document.getElementById("password-rules");
    const message = document.getElementById("signup-message");

    // Empêche de choisir une date dans le futur
    birthdate.max = new Date().toISOString().split("T")[0];

    function validateFullname() {
        if (fullname.value.trim().length < 2) {
            return setError(fullname, "Veuillez entrer votre nom complet.");
        }
        return setError(fullname, "");
    }

    function validateUsername() {
        const value = username.value.trim();
        if (!/^[A-Za-z0-9_.-]{3,20}$/.test(value)) {
            return setError(username, "3 à 20 caractères : lettres, chiffres, . _ -");
        }
        const taken = getAccounts().some((a) => a.username.toLowerCase() === value.toLowerCase());
        if (taken) {
            return setError(username, "Ce nom d'utilisateur est déjà pris.");
        }
        return setError(username, "");
    }

    function validateEmail() {
        const value = email.value.trim();
        if (!EMAIL_REGEX.test(value)) {
            return setError(email, "Adresse courriel invalide.");
        }
        const taken = getAccounts().some((a) => a.email === value.toLowerCase());
        if (taken) {
            return setError(email, "Un compte existe déjà avec cette adresse.");
        }
        return setError(email, "");
    }

    function validateBirthdate() {
        if (!birthdate.value) {
            return setError(birthdate, "Veuillez entrer votre date de naissance.");
        }
        const birth = new Date(birthdate.value);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const birthdayPassed =
            today.getMonth() > birth.getMonth() ||
            (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
        if (!birthdayPassed) {
            age--;
        }
        if (age < 13) {
            return setError(birthdate, "Vous devez avoir au moins 13 ans.");
        }
        return setError(birthdate, "");
    }

    function validatePassword() {
        if (!isPasswordStrong(password.value)) {
            return setError(password, "Le mot de passe ne respecte pas tous les critères.");
        }
        return setError(password, "");
    }

    function validateConfirm() {
        if (confirm.value === "" || confirm.value !== password.value) {
            return setError(confirm, "Les mots de passe ne correspondent pas.");
        }
        return setError(confirm, "");
    }

    // Validation quand on quitte un champ
    fullname.addEventListener("blur", validateFullname);
    username.addEventListener("blur", validateUsername);
    email.addEventListener("blur", validateEmail);
    birthdate.addEventListener("change", validateBirthdate);
    confirm.addEventListener("input", validateConfirm);
    password.addEventListener("input", () => {
        updatePasswordRules(password, rulesList);
        if (confirm.value !== "") {
            validateConfirm();
        }
    });

    signupForm.addEventListener("submit", (event) => {
        event.preventDefault();

        // On valide tout (sans s'arrêter au premier champ invalide)
        const results = [
            validateFullname(),
            validateUsername(),
            validateEmail(),
            validateBirthdate(),
            validatePassword(),
            validateConfirm()
        ];

        if (results.includes(false)) {
            showMessage(message, "Veuillez corriger les champs en rouge.", "fail");
            return;
        }

        const accounts = getAccounts();
        accounts.push({
            fullname: fullname.value.trim(),
            username: username.value.trim(),
            email: email.value.trim().toLowerCase(),
            birthdate: birthdate.value,
            password: password.value // À remplacer par un hachage côté serveur
        });
        saveAccounts(accounts);

        showMessage(message, "Compte créé avec succès ! Redirection vers la connexion...", "success");
        signupForm.reset();
        signupForm.querySelectorAll("input").forEach((i) => i.classList.remove("valid", "invalid"));
        updatePasswordRules(password, rulesList);

        setTimeout(() => {
            window.location.href = "index.html";
        }, 2000);
    });
}

// ---------- Page : mot de passe oublié ----------

const stepEmail = document.getElementById("step-email");

if (stepEmail) {
    const stepCode = document.getElementById("step-code");
    const stepPassword = document.getElementById("step-password");
    const stepDone = document.getElementById("step-done");
    const description = document.getElementById("step-description");
    const message = document.getElementById("reset-message");
    const indicators = document.querySelectorAll(".steps-indicator span");

    const resetEmail = document.getElementById("reset-email");
    const resetCode = document.getElementById("reset-code");
    const newPassword = document.getElementById("new-password");
    const newConfirm = document.getElementById("new-confirm");
    const rulesList = document.getElementById("new-password-rules");

    let generatedCode = "";
    let currentEmail = "";

    function goToStep(stepElement, stepNumber, text) {
        [stepEmail, stepCode, stepPassword, stepDone].forEach((s) => s.classList.remove("active"));
        stepElement.classList.add("active");
        indicators.forEach((span, index) => span.classList.toggle("done", index < stepNumber));
        description.textContent = text;
    }

    // Simule l'envoi d'un courriel : le code est affiché à l'écran
    function sendCode() {
        generatedCode = String(Math.floor(100000 + Math.random() * 900000));
        showMessage(
            message,
            "Un code a été envoyé à " + currentEmail + ". (Simulation : votre code est " + generatedCode + ")",
            "info"
        );
    }

    // Étape 1 : vérifier le courriel
    stepEmail.addEventListener("submit", (event) => {
        event.preventDefault();
        const value = resetEmail.value.trim().toLowerCase();

        if (!EMAIL_REGEX.test(value)) {
            setError(resetEmail, "Adresse courriel invalide.");
            return;
        }

        const exists = getAccounts().some((a) => a.email === value);
        if (!exists) {
            setError(resetEmail, "Aucun compte n'est associé à cette adresse.");
            return;
        }

        setError(resetEmail, "");
        currentEmail = value;
        sendCode();
        goToStep(stepCode, 2, "Entrez le code à 6 chiffres reçu par courriel.");
        resetCode.focus();
    });

    // Étape 2 : vérifier le code
    resetCode.addEventListener("input", () => {
        resetCode.value = resetCode.value.replace(/\D/g, ""); // chiffres seulement
    });

    stepCode.addEventListener("submit", (event) => {
        event.preventDefault();
        if (resetCode.value !== generatedCode) {
            setError(resetCode, "Code incorrect. Veuillez réessayer.");
            return;
        }
        setError(resetCode, "");
        message.className = "message";
        goToStep(stepPassword, 3, "Choisissez un nouveau mot de passe.");
        newPassword.focus();
    });

    document.getElementById("resend-code").addEventListener("click", () => {
        sendCode();
        resetCode.value = "";
        setError(resetCode, "");
    });

    // Étape 3 : nouveau mot de passe
    newPassword.addEventListener("input", () => updatePasswordRules(newPassword, rulesList));

    stepPassword.addEventListener("submit", (event) => {
        event.preventDefault();

        const passwordOk = isPasswordStrong(newPassword.value)
            ? setError(newPassword, "")
            : setError(newPassword, "Le mot de passe ne respecte pas tous les critères.");

        const confirmOk = newConfirm.value !== "" && newConfirm.value === newPassword.value
            ? setError(newConfirm, "")
            : setError(newConfirm, "Les mots de passe ne correspondent pas.");

        if (!passwordOk || !confirmOk) {
            return;
        }

        const accounts = getAccounts();
        const account = accounts.find((a) => a.email === currentEmail);
        account.password = newPassword.value;
        saveAccounts(accounts);

        showMessage(message, "Votre mot de passe a été réinitialisé avec succès !", "success");
        goToStep(stepDone, 3, "Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.");
    });
}

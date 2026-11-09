// ===== Script d'authentification WorkFlow avec Supabase =====

// ---------- Fonctions utilitaires & Validation ----------

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PASSWORD_RULES = {
  length: (mdp) => mdp.length >= 8,
  upper: (mdp) => /[A-Z]/.test(mdp),
  lower: (mdp) => /[a-z]/.test(mdp),
  digit: (mdp) => /[0-9]/.test(mdp),
  special: (mdp) => /[^A-Za-z0-9]/.test(mdp)
};

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

function updatePasswordRules(input, rulesList) {
  if (!rulesList) return;
  rulesList.querySelectorAll("li").forEach((li) => {
    const rule = PASSWORD_RULES[li.dataset.rule];
    if (rule) {
      li.classList.toggle("ok", rule(input.value));
    }
  });
}

// Boutons « Afficher / Masquer » des mots de passe
document.querySelectorAll(".toggle-password").forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.target);
    if (!input) return;
    const hidden = input.type === "password";
    input.type = hidden ? "text" : "password";
    button.textContent = hidden ? "Masquer" : "Afficher";
  });
});

// ---------- Page : Connexion (index.html) ----------

const loginForm = document.getElementById("login-form");

if (loginForm) {
  const loginId = document.getElementById("login-id");
  const loginPassword = document.getElementById("login-password");
  const remember = document.getElementById("remember");
  const message = document.getElementById("login-message");

  // Remplissage du champ si "Se souvenir de moi" était coché
  try {
    const saved = localStorage.getItem("workflow_remember");
    if (saved && loginId) {
      loginId.value = saved;
      if (remember) remember.checked = true;
    }
  } catch (e) {}

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const idValue = loginId.value.trim().toLowerCase();
    const idOk = idValue === ""
      ? setError(loginId, "Veuillez entrer votre adresse courriel.")
      : setError(loginId, "");
    const passwordOk = loginPassword.value === ""
      ? setError(loginPassword, "Veuillez entrer votre mot de passe.")
      : setError(loginPassword, "");

    if (!idOk || !passwordOk) return;

    showMessage(message, "Connexion en cours...", "info");

    // Appel d'authentification Supabase
    const { data, error } = await AuthService.signIn(idValue, loginPassword.value);

    if (error) {
      loginId.classList.add("invalid");
      loginPassword.classList.add("invalid");
      showMessage(message, "Courriel ou mot de passe incorrect.", "fail");
      return;
    }

    try {
      if (remember && remember.checked) {
        localStorage.setItem("workflow_remember", idValue);
      } else {
        localStorage.removeItem("workflow_remember");
      }
    } catch (e) {}

    const displayName = data.user?.user_metadata?.username || data.user?.user_metadata?.full_name || "sur WorkFlow";
    showMessage(message, `Bienvenue ${displayName} ! Redirection en cours...`, "success");

    setTimeout(() => {
      window.location.href = "home.html";
    }, 1200);
  });
}

// ---------- Page : Création de compte (Création_Compte.html) ----------

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

  if (birthdate) {
    birthdate.max = new Date().toISOString().split("T")[0];
  }

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
    return setError(username, "");
  }

  function validateEmail() {
    const value = email.value.trim();
    if (!EMAIL_REGEX.test(value)) {
      return setError(email, "Adresse courriel invalide.");
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
    if (!birthdayPassed) age--;
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

  // Écouteurs de validation en direct
  fullname.addEventListener("blur", validateFullname);
  username.addEventListener("blur", validateUsername);
  email.addEventListener("blur", validateEmail);
  birthdate.addEventListener("change", validateBirthdate);
  confirm.addEventListener("input", validateConfirm);
  password.addEventListener("input", () => {
    updatePasswordRules(password, rulesList);
    if (confirm.value !== "") validateConfirm();
  });

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

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

    showMessage(message, "Création du compte en cours sur Supabase...", "info");

    // Inscription officielle dans Supabase avec sauvegarde des données du profil
    const { data, error } = await supabaseClient.auth.signUp({
      email: email.value.trim().toLowerCase(),
      password: password.value,
      options: {
        data: {
          full_name: fullname.value.trim(),
          username: username.value.trim(),
          birthdate: birthdate.value
        }
      }
    });

    if (error) {
      showMessage(message, error.message, "fail");
      return;
    }

    if (data.user && data.user.identities && data.user.identities.length === 0) {
      showMessage(message, "Un compte existe déjà avec cette adresse courriel.", "fail");
      return;
    }

    // Si Supabase requiert la confirmation par mail
    if (!data.session) {
      showMessage(message, "Compte créé ! Veuillez vérifier vos courriels pour confirmer l'inscription.", "success");
      return;
    }

    showMessage(message, "Compte créé avec succès ! Connexion en cours...", "success");
    setTimeout(() => {
      window.location.href = "home.html";
    }, 1500);
  });
}

// ---------- Page : Mot de passe oublié (MDP_oublié.html) ----------

const stepEmail = document.getElementById("step-email");

if (stepEmail) {
  const resetEmail = document.getElementById("reset-email");
  const message = document.getElementById("reset-message");

  stepEmail.addEventListener("submit", async (event) => {
    event.preventDefault();
    const emailVal = resetEmail.value.trim().toLowerCase();

    if (!EMAIL_REGEX.test(emailVal)) {
      setError(resetEmail, "Adresse courriel invalide.");
      return;
    }

    setError(resetEmail, "");
    showMessage(message, "Envoi du lien de réinitialisation...", "info");

    // Supabase gère directement l'envoi sécurisé du courriel avec le lien de réinitialisation
    const { error } = await supabaseClient.auth.resetPasswordForEmail(emailVal, {
      redirectTo: window.location.origin + "/MDP_oublié.html"
    });

    if (error) {
      showMessage(message, error.message, "fail");
      return;
    }

    showMessage(message, "Un lien de réinitialisation a été envoyé à votre adresse courriel !", "success");
  });
}
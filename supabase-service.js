// --- 1. CONFIGURATION SUPABASE ---
const SUPABASE_URL = "https://qgtpterfnrltrmsygbrh.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_X8CN-z4V1TrT3eNmq_GrmQ_nNfDNrRU";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// --- 2. STOCKAGE LOCAL & THÈMES ---
const StorageService = {
  KEY_THEME: "site-theme",
  KEY_CHANNEL: "keyCurrentChannel",

  readTheme() {
    return localStorage.getItem(this.KEY_THEME) || "light";
  },

  writeTheme(theme) {
    localStorage.setItem(this.KEY_THEME, theme);
    this.applyTheme(theme);
  },

  applyTheme(theme) {
    if (theme === "dark") {
      document.documentElement.classList.add("dark-theme");
    } else {
      document.documentElement.classList.remove("dark-theme");
    }
  },

  readChannel() {
    try { return JSON.parse(sessionStorage.getItem(this.KEY_CHANNEL)); } catch { return null; }
  },

  writeChannel(channel) {
    sessionStorage.setItem(this.KEY_CHANNEL, JSON.stringify(channel));
  },

  clearSession() {
    sessionStorage.clear();
  }
};

// Initialisation du thème immédiate
StorageService.applyTheme(StorageService.readTheme());
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (StorageService.readTheme() === "system") StorageService.applyTheme("system");
});

// --- 3. AUTHENTIFICATION ---
const AuthService = {
  async signIn(email, password) {
    return await supabaseClient.auth.signInWithPassword({ email, password });
  },

  async signUp(email, password) {
    return await supabaseClient.auth.signUp({ email, password });
  },

  async signOut() {
    return await supabaseClient.auth.signOut();
  },

  async getUser() {
    const { data, error } = await supabaseClient.auth.getSession();
    return { user: data?.session?.user ?? null, error };
  },

  onSessionChange(callback) {
    supabaseClient.auth.onAuthStateChange((event, session) => callback(event, session));
  }
};

// --- 4. BASE DE DONNÉES (CORRIGÉE SELON TON SCHÉMA) ---
const ChatDatabase = {
  async fetchChannels() {
    // Récupère l'id, le nom et created_by de la table channels
    return await supabaseClient.from("channels").select("id, name, created_by").order("name");
  },

  async createChannel(name, userId) {
    // Insère le salon en enregistrant qui l'a créé (created_by)
    return await supabaseClient.from("channels").insert({ 
      name, 
      created_by: userId 
    }).select().single();
  },

  async fetchMessages(channelId) {
    // Sélectionne les messages pour un salon (id, content, created_at, created_by, "channels.id", username)
    return await supabaseClient
      .from("messages")
      .select('id, content, created_at, created_by, "channels.id", username')
      .eq("channels.id", channelId) // Ton lien vers les salons
      .limit(50)
      .order("created_at", { ascending: true });
  },

  async sendMessage(channelId, content, username, userId) {
    // Insère le message en se liant à channels.id, created_by et en fournissant le username
    return await supabaseClient.from("messages").insert({
      "channels.id": channelId, // Clé avec point corrigée
      content,
      username,
      created_by: userId // Relié à l'utilisateur
    });
  },

  subscribeToChannels(onNewChannel) {
    return supabaseClient
      .channel("channels-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "channels" }, (payload) =>
        onNewChannel(payload.new)
      )
      .subscribe();
  },

  subscribeToMessages(channelId, onNewMessage) {
    const channel = supabaseClient
      .channel(`messages-${channelId}`)
      .on(
        "postgres_changes",
        { 
          event: "INSERT", 
          schema: "public", 
          table: "messages", 
          filter: `"channels.id"=eq.${channelId}` // Filtrage exact avec point et guillemets
        },
        (payload) => onNewMessage(payload.new)
      )
      .subscribe();

    return () => supabaseClient.removeChannel(channel);
  }
};
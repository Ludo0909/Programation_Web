// --- 1. CONFIGURATION SUPABASE ---
const SUPABASE_URL = "https://pwqifxakeouwsuycvngx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_rrbz_Z59y-VTRvSmjvsuew_wyZX-XjK";

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

// --- 4. BASE DE DONNÉES (CORRIGÉE SELON TON SCHÉMA AVEC "channels.id") ---
const ChatDatabase = {
  async fetchChannels() {
    return await supabaseClient.from("channels").select("id, name, created_by").order("name");
  },

  async createChannel(name, userId) {
    return await supabaseClient.from("channels").insert({ 
      name, 
      created_by: userId 
    }).select().single();
  },
  
  async fetchMessages(channelId) {
    return await supabaseClient
      .from("messages")
      .select("id, content, created_at, created_by, channel_id, username")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: true });
  },

  async sendMessage(channelId, content, username, userId) {
    return await supabaseClient.from("messages").insert([
      {
        channel_id: channelId,
        content: content,
        username: username,
        created_by: userId
      }
    ]);
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
          filter: `channel_id=eq.${channelId}`
        },
        (payload) => onNewMessage(payload.new)
      )
      .subscribe();

    return () => supabaseClient.removeChannel(channel);
  }
};

const EventDatabase = {
  // Récupérer les événements d'un salon précis
  async fetchEvents(channelId) {
    return await supabaseClient
      .from("events")
      .select("*")
      .eq("channel_id", channelId)
      .order("start_time", { ascending: true });
  },

  // Récupérer les événements officiels (non occupés) pour le tableau de bord
  async fetchUpcomingMeetings() {
    const now = new Date().toISOString();
    return await supabaseClient
      .from("events")
      .select("id, title, start_time, end_time, category")
      .neq("category", "occupe") // Exclut les indisponibilités
      .gte("start_time", now)
      .order("start_time", { ascending: true })
      .limit(3);
  },

  // Ajouter un nouvel événement ou créneau d'indisponibilité
  async addEvent({ title, startTime, endTime, category, channelId, userId }) {
    return await supabaseClient
      .from("events")
      .insert({
        title,
        start_time: startTime,
        end_time: endTime,
        category, // "reunion", "projet" ou "occupe"
        channel_id: channelId,
        user_id: userId
      });
  }
};
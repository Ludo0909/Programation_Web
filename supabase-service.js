
const SUPABASE_URL=https://pwqifxakeouwsuycvngx.supabase.co
const SUPABASE_KEY=sb_publishable_rrbz_Z59y-VTRvSmjvsuew_wyZX-XjK

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const StorageService = {
  KEY_THEME: "keyCurrentTheme",
  KEY_CHANNEL: "keyCurrentChannel",

  readTheme() {
    try {
      return localStorage.getItem(this.KEY_THEME) || "system";
    } catch {
      return "system";
    }
  },

  writeTheme(theme) {
    localStorage.setItem(this.KEY_THEME, theme);
    this.applyTheme(theme);
  },

  applyTheme(theme) {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = theme === "dark" || (theme === "system" && prefersDark);
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  },

  readChannel() {
    try {
      return JSON.parse(sessionStorage.getItem(this.KEY_CHANNEL));
    } catch {
      return null;
    }
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

// --- 4. BASE DE DONNÉES (CHANNELS & MESSAGES) ---
const ChatDatabase = {
  async fetchChannels() {
    return await supabaseClient.from("channels").select("*").order("name");
  },

  async createChannel(name) {
    return await supabaseClient.from("channels").insert({ name }).select().single();
  },

  async fetchMessages(channelId) {
    return await supabaseClient
      .from("messages")
      .select("id, content, created_at, user_id, username")
      .eq("channel_id", channelId)
      .limit(50)
      .order("created_at", { ascending: true });
  },

  async sendMessage(channelId, content, username) {
    return await supabaseClient.from("messages").insert({
      channel_id: channelId,
      content,
      username
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
        { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${channelId}` },
        (payload) => onNewMessage(payload.new)
      )
      .subscribe();

    return () => supabaseClient.removeChannel(channel);
  }
};
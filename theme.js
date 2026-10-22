if (localStorage.getItem('site-theme') === 'dark') {
  document.documentElement.classList.add('dark-theme');
} else {
  document.documentElement.classList.remove('dark-theme');
}

SUPABASE_URL=https://pwqifxakeouwsuycvngx.supabase.co
SUPABASE_KEY=sb_publishable_rrbz_Z59y-VTRvSmjvsuew_wyZX-XjK
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function chargerDonnees() {
  const { data, error } = await supabaseClient
    .from('messages')
    .select('*');    

  if (error) {
    console.error("Erreur de connexion :", error.message);
  } else {
    console.log("Données reçues :", data);
  }
}

chargerDonnees();
if (localStorage.getItem('site-theme') === 'dark') {
  document.documentElement.classList.add('dark-theme');
} else {
  document.documentElement.classList.remove('dark-theme');
}

const SUPABASE_URL=https://pwqifxakeouwsuycvngx.supabase.co
const SUPABASE_KEY=sb_publishable_rrbz_Z59y-VTRvSmjvsuew_wyZX-XjK

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

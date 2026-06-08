// Copy this file to `config.js` and fill in the values from your Supabase project.
// (Settings → API in the Supabase dashboard.)
//
// The anon key is designed to be public: the browser only uses it to call the
// `generate` Edge Function. All privileged work (reading your profile with the
// service-role key, calling Claude) happens server-side inside the function —
// never replace this with the service_role key.
window.RECUTER_CONFIG = {
  SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR-ANON-KEY"
};

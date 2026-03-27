/**
 * SFM Zeiterfassung - Configuration & Infrastructure
 * Prepare for Supabase and Google Maps integration
 */

const Config = {
    // ─── Supabase ────────────────────────────────────────────────────────────
    // Werte aus: Supabase Dashboard → Project Settings → API
    supabase: {
        url: '',   // z.B. 'https://xyzabcdef.supabase.co'
        key: ''    // anon/public key
    },

    // ─── Google Maps ─────────────────────────────────────────────────────────
    googleMaps: {
        apiKey: '' // Google Cloud Console → Maps JavaScript API
    },

    // ─── Feature Flags ───────────────────────────────────────────────────────
    // true  = localStorage Mock-Daten (kein Supabase nötig)
    // false = Supabase (URL + Key müssen oben eingetragen sein)
    useMockData: false,
    useGoogleMaps: false,

    debug: true
};

// Export to window for global access
window.Config = Config;
window.SFM_CONFIG = Config;

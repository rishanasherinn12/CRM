export default function SetupNotice() {
  return (
    <div className="fullscreen-center">
      <div className="auth-card">
        <h1>Connect Supabase</h1>
        <p className="muted">The app needs your Supabase project credentials before it can run.</p>
        <ol className="setup-steps">
          <li>
            Copy <code>.env.example</code> to <code>.env</code>
          </li>
          <li>
            Fill in <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> from your Supabase project settings (API)
          </li>
          <li>
            Run <code>supabase/schema.sql</code> in the Supabase SQL Editor
          </li>
          <li>Restart the dev server</li>
        </ol>
      </div>
    </div>
  )
}

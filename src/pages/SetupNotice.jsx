export default function SetupNotice() {
  return (
    <div className="center-page">
      <div className="card narrow">
        <h1>Falta configurar Supabase</h1>
        <p>Crea un archivo <code>.env.local</code> en la raíz del proyecto (puedes copiar <code>.env.example</code>) con:</p>
        <pre className="code-block">{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxxx`}</pre>
        <p>Luego reinicia <code>npm run dev</code>. Las instrucciones completas están en el README.</p>
      </div>
    </div>
  )
}

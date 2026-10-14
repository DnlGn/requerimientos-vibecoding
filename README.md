# VibeCheck · Analizador de proyectos Vibecoding

Herramienta docente para analizar proyectos web hechos por alumnos con **Google AI Studio**, tomar anotaciones y entregar un **informe público con QR**.

- **Con link**: análisis automático (PageSpeed móvil y escritorio, Core Web Vitals, metadata, Open Graph, `robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt`, manifest, API keys expuestas, Tailwind por CDN…) que pre-rellena la rúbrica, más evaluación manual.
- **Sin link**: rúbrica 100 % manual.
- **Informe** en `/r/:slug`: se genera al publicar, con QR descargable, y se puede imprimir o guardar como PDF. Las notas privadas nunca se publican.
- Interfaz pensada para **tablet** (navegación lateral en horizontal, chips en vertical, botones de 48 px o más), responsive en celular y escritorio.

## Stack

React 19 + Vite (JSX) · React Router · Supabase (Auth, Postgres con RLS, Edge Function) · Google PageSpeed Insights API · qrcode.react

## Puesta en marcha

### 1. Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Aplica la migración `supabase/migrations/20261013000000_init.sql` (desde el SQL Editor, o con `supabase db push`).
3. Despliega la Edge Function:
   ```bash
   supabase functions deploy analyze-site --project-ref <tu-ref>
   ```
   (Exige JWT: solo usuarios con sesión iniciada pueden usarla.)
4. En **Authentication → Providers → Email**, decide si quieres exigir la confirmación por correo.
5. En **Authentication → URL Configuration**, agrega la URL de producción.

### 2. Variables de entorno

Copia `.env.example` a `.env.local`:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxxx
VITE_PSI_API_KEY=            # recomendado
VITE_PUBLIC_BASE_URL=        # dominio público para los QR
```

**PageSpeed API key**: sin key, Google comparte una cuota muy limitada y suele responder 429. Puedes crear una gratis en Google Cloud Console (habilitando "PageSpeed Insights API") y restringirla a tu dominio.

### 3. Desarrollo

```bash
npm install
npm run dev
```

Para probar en la tablet dentro de la misma red: `npm run dev -- --host` y abre la IP que muestra la terminal.

> Los QR usan `VITE_PUBLIC_BASE_URL` o, si está vacío, el dominio actual. Si generas un QR desde `localhost`, no funcionará en otro dispositivo.

### 4. Deploy

Funciona en Vercel o Netlify. Ya vienen incluidos `vercel.json` y `public/_redirects` con las reglas de reescritura de la SPA. Configura allí las mismas variables `VITE_*`.

## Estructura

```
src/
  lib/checklist.js     ← rúbrica: categorías, pesos, criterios y reglas automáticas
  lib/scoring.js       ← cálculo de puntajes y niveles
  lib/pagespeed.js     ← cliente de PageSpeed Insights
  lib/analyzer.js      ← orquesta Edge Function + PageSpeed
  pages/               ← Dashboard, NewAnalysis, AnalysisEditor, PublicReport, Login
  components/          ← CriterionCard, AutoResults, DevicePreview, QrModal, ScoreRing
supabase/
  migrations/          ← tabla analyses + RLS + RPC get_public_report
  functions/analyze-site/ ← descarga y analiza HTML y archivos de posicionamiento
```

### Personalizar la rúbrica

Todo está en [src/lib/checklist.js](src/lib/checklist.js). Cada categoría tiene un `weight` (peso en el puntaje final) y cada criterio puede tener una función `auto(r)` que recibe `{ site, mobile, desktop }` y devuelve `{ status: 'pass' | 'partial' | 'fail' | null, detail }`. Si cambias el id de un criterio, se pierden las evaluaciones guardadas con el id anterior.

Puntaje: Cumple = 1, Parcial = 0,5, No cumple = 0, y "No aplica" no cuenta. Se promedia por categoría y luego se pondera según los pesos. Si un docente cambia a mano un criterio, ese valor se respeta aunque se vuelva a correr el análisis automático.

## Seguridad

- RLS: cada docente solo ve sus propios análisis.
- El informe público se lee mediante la función `get_public_report(slug)` (security definer), que devuelve un único informe publicado y sin `private_notes`. No permite listar los demás.
- La Edge Function exige sesión y bloquea hosts privados (localhost, 10.x, 192.168.x, etc.).

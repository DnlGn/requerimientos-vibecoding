// Rúbrica de evaluación de proyectos Vibecoding (Google AI Studio).
// Cada criterio puede tener `auto(r)` que recibe auto_results y sugiere un estado.
// r = { site, mobile, desktop }  (cualquiera puede ser null)

import { Accessibility, Bot, Gauge, Palette, Search, ShieldCheck, Smartphone } from 'lucide-react'

export const STATUS = {
  pass: { label: 'Cumple', short: 'Sí', value: 1 },
  partial: { label: 'Parcial', short: '½', value: 0.5 },
  fail: { label: 'No cumple', short: 'No', value: 0 },
  na: { label: 'No aplica', short: 'N/A', value: null },
}

const ms = (v) => (v == null ? '—' : v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${Math.round(v)} ms`)
const res = (status, detail) => ({ status, detail })
const range = (len, min, max) => len >= min && len <= max

export const CATEGORIES = [
  {
    id: 'responsive',
    title: 'Responsive',
    icon: Smartphone,
    weight: 20,
    summary: 'La página se adapta y se ve bien en celular, tablet y computador.',
    criteria: [
      {
        id: 'viewport',
        title: 'Meta viewport configurado',
        help: 'Sin <meta name="viewport" content="width=device-width, initial-scale=1"> el celular muestra la versión de escritorio en miniatura.',
        auto: ({ site, mobile }) => {
          if (site) {
            const v = site.meta.viewport || ''
            if (v.includes('width=device-width')) {
              const blocksZoom = /user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?(?![\d.])/.test(v)
              return blocksZoom ? res('partial', `Bloquea el zoom: "${v}" (mala práctica de accesibilidad)`) : res('pass', `"${v}"`)
            }
            return res('fail', v ? `Viewport incorrecto: "${v}"` : 'No tiene meta viewport')
          }
          if (mobile?.audits.viewport != null) return res(mobile.audits.viewport === 1 ? 'pass' : 'fail', 'Según Lighthouse')
          return null
        },
      },
      { id: 'mobile-layout', title: 'Se ve bien en celular (≤ 480 px)', help: 'Sin scroll horizontal, sin textos cortados ni elementos encimados. Probar girando el celular.' },
      { id: 'tablet-layout', title: 'Se ve bien en tablet (768 – 1024 px)', help: 'Aprovecha el espacio: no es solo la versión celular estirada, ni la de escritorio apretada.' },
      { id: 'desktop-layout', title: 'Se ve bien en escritorio (≥ 1280 px)', help: 'El contenido tiene un ancho máximo legible y no queda todo pegado a la izquierda.' },
      {
        id: 'touch-targets',
        title: 'Botones y enlaces fáciles de tocar',
        help: 'Áreas táctiles de al menos 44×44 px y separadas entre sí.',
        auto: ({ mobile }) => (mobile?.audits.targetSize != null ? res(mobile.audits.targetSize >= 0.9 ? 'pass' : 'partial', 'Auditoría de tamaño de objetivos táctiles (Lighthouse)') : null),
      },
      {
        id: 'font-legible',
        title: 'Textos legibles sin hacer zoom',
        help: 'Texto base de 16 px o más en celular, buen interlineado y líneas no demasiado largas.',
      },
      {
        id: 'responsive-images',
        title: 'Imágenes que se adaptan',
        help: 'Las imágenes no se deforman ni desbordan; se sirven en tamaños adecuados a cada pantalla.',
        auto: ({ mobile }) => (mobile?.audits.responsiveImages != null ? res(mobile.audits.responsiveImages >= 0.9 ? 'pass' : 'partial', 'Tamaño de imágenes según Lighthouse') : null),
      },
    ],
  },
  {
    id: 'uxui',
    title: 'UX / UI',
    icon: Palette,
    weight: 20,
    summary: 'Diseño visual coherente y una experiencia clara para el usuario.',
    criteria: [
      { id: 'value-prop', title: 'Propuesta de valor clara', help: 'En 5 segundos se entiende qué es, para quién es y qué puedo hacer.' },
      { id: 'hierarchy', title: 'Jerarquía visual', help: 'Títulos, subtítulos y textos con tamaños y pesos que guían la lectura. Lo importante destaca.' },
      { id: 'consistency', title: 'Coherencia de colores y tipografía', help: 'Paleta limitada (2–4 colores) y máximo 2 familias tipográficas, aplicadas de forma consistente.' },
      { id: 'spacing', title: 'Espaciado y alineación', help: 'Márgenes consistentes, aire entre secciones, elementos alineados a una grilla.' },
      { id: 'navigation', title: 'Navegación intuitiva', help: 'El menú es claro, se sabe dónde estoy y cómo volver. Funciona en celular (menú hamburguesa, etc.).' },
      { id: 'cta', title: 'Llamados a la acción (CTA)', help: 'Los botones principales se distinguen y dicen claramente qué hacen.' },
      { id: 'feedback', title: 'Estados e interacción', help: 'Hover, foco, carga, errores y éxito tienen respuesta visual. Nada se siente "muerto".' },
      { id: 'forms', title: 'Formularios usables', help: 'Etiquetas visibles, tipos de input correctos (email, tel), validación y mensajes de error claros.' },
      { id: 'real-content', title: 'Contenido real y bien escrito', help: 'Sin "Lorem ipsum", textos genéricos de la IA, faltas de ortografía ni imágenes placeholder.' },
      { id: 'identity', title: 'Identidad propia', help: 'Tiene marca/logo y una estética propia; no parece la plantilla por defecto que generó la IA.' },
    ],
  },
  {
    id: 'performance',
    title: 'Rendimiento',
    icon: Gauge,
    weight: 20,
    summary: 'Carga rápida y estable en distintos dispositivos (Core Web Vitals).',
    criteria: [
      {
        id: 'lcp-mobile',
        title: 'LCP en celular ≤ 2,5 s',
        help: 'Largest Contentful Paint: cuánto tarda en aparecer el elemento principal. Bueno ≤ 2,5 s · Mejorable ≤ 4 s.',
        auto: ({ mobile }) => {
          const v = mobile?.metrics.lcp
          if (v == null) return null
          return res(v <= 2500 ? 'pass' : v <= 4000 ? 'partial' : 'fail', `LCP móvil: ${ms(v)}`)
        },
      },
      {
        id: 'lcp-desktop',
        title: 'LCP en escritorio ≤ 2,5 s',
        help: 'Lo mismo, medido en un computador con buena conexión.',
        auto: ({ desktop }) => {
          const v = desktop?.metrics.lcp
          if (v == null) return null
          return res(v <= 2500 ? 'pass' : v <= 4000 ? 'partial' : 'fail', `LCP escritorio: ${ms(v)}`)
        },
      },
      {
        id: 'cls',
        title: 'Estabilidad visual (CLS ≤ 0,1)',
        help: 'Cumulative Layout Shift: que los elementos no "salten" mientras carga la página.',
        auto: ({ mobile }) => {
          const v = mobile?.metrics.cls
          if (v == null) return null
          return res(v <= 0.1 ? 'pass' : v <= 0.25 ? 'partial' : 'fail', `CLS: ${v.toFixed(3)}`)
        },
      },
      {
        id: 'tbt',
        title: 'Interactividad (TBT ≤ 200 ms)',
        help: 'Total Blocking Time: cuánto tiempo el JavaScript bloquea la página. Se relaciona con INP.',
        auto: ({ mobile }) => {
          const v = mobile?.metrics.tbt
          if (v == null) return null
          return res(v <= 200 ? 'pass' : v <= 600 ? 'partial' : 'fail', `TBT móvil: ${ms(v)}`)
        },
      },
      {
        id: 'perf-score-mobile',
        title: 'Puntaje de rendimiento móvil ≥ 90',
        help: 'Puntaje general de Lighthouse simulando un celular de gama media con 4G.',
        auto: ({ mobile }) => {
          const v = mobile?.scores.performance
          if (v == null) return null
          return res(v >= 90 ? 'pass' : v >= 50 ? 'partial' : 'fail', `Rendimiento móvil: ${v}/100`)
        },
      },
      {
        id: 'perf-score-desktop',
        title: 'Puntaje de rendimiento escritorio ≥ 90',
        help: 'Puntaje general de Lighthouse en escritorio.',
        auto: ({ desktop }) => {
          const v = desktop?.scores.performance
          if (v == null) return null
          return res(v >= 90 ? 'pass' : v >= 50 ? 'partial' : 'fail', `Rendimiento escritorio: ${v}/100`)
        },
      },
      {
        id: 'images-optimized',
        title: 'Imágenes optimizadas',
        help: 'Formatos modernos (WebP/AVIF), comprimidas, con width/height y carga diferida (loading="lazy") fuera de pantalla.',
        // Se usa Lighthouse (DOM ya renderizado). El HTML inicial de una SPA no tiene
        // imágenes, así que contarlas ahí daría un "Cumple" falso.
        auto: ({ mobile, site }) => {
          if (mobile) {
            const { imageDelivery: d, unsizedImages: u } = mobile.audits
            if (d == null && u == null) return res('pass', 'Lighthouse no encontró imágenes que optimizar')
            const parts = []
            if (d != null) parts.push(d >= 0.9 ? 'Formato y peso OK' : 'Hay imágenes pesadas o en formatos antiguos (usar WebP/AVIF)')
            if (u != null) parts.push(u === 1 ? 'todas con width/height' : 'hay imágenes sin width/height (causan saltos)')
            const bad = [d, u].filter((v) => v != null && v < 0.9).length
            return res(bad === 0 ? 'pass' : bad === 2 || (d != null && d < 0.5) ? 'fail' : 'partial', parts.join(' · '))
          }
          if (site && !site.content.isSpaShell && site.content.images.total) {
            const { total, withoutDimensions: w } = site.content.images
            return res(w === 0 ? 'pass' : 'partial', `${w}/${total} imágenes sin width/height en el HTML (sin datos de PageSpeed)`)
          }
          return null
        },
      },
      {
        id: 'no-dev-deps',
        title: 'Sin herramientas de desarrollo en producción',
        help: 'AI Studio suele generar el proyecto con Tailwind por CDN e importmaps. En producción conviene compilar (Vite build) para cargar menos y más rápido.',
        auto: ({ site }) => {
          if (!site) return null
          const issues = []
          if (site.tech.tailwindCdn) issues.push('Tailwind por CDN (cdn.tailwindcss.com)')
          if (site.tech.babelStandalone) issues.push('Babel en el navegador')
          if (site.tech.importMapHosts.length) issues.push(`importmap desde ${site.tech.importMapHosts.join(', ')}`)
          return issues.length ? res(issues.length > 1 ? 'fail' : 'partial', issues.join(' · ')) : res('pass', 'Proyecto compilado para producción')
        },
      },
    ],
  },
  {
    id: 'seo',
    title: 'SEO y metadata',
    icon: Search,
    weight: 15,
    summary: 'Buscadores y redes sociales entienden y muestran bien la página.',
    criteria: [
      {
        id: 'title',
        title: 'Título (<title>) descriptivo',
        help: 'Entre 15 y 60 caracteres, único y con el nombre del proyecto. No "Vite + React" ni el nombre por defecto.',
        auto: ({ site }) => {
          if (!site) return null
          const t = site.meta.title
          if (!t) return res('fail', 'No tiene <title>')
          if (/vite \+ react|react app|ai studio|untitled|my google ai studio app/i.test(t)) return res('fail', `Título por defecto: "${t}"`)
          return res(range(t.length, 15, 60) ? 'pass' : 'partial', `"${t}" (${t.length} caracteres)`)
        },
      },
      {
        id: 'description',
        title: 'Meta description',
        help: 'Resumen de 70 a 160 caracteres que aparece en Google bajo el título.',
        auto: ({ site }) => {
          if (!site) return null
          const d = site.meta.description
          if (!d) return res('fail', 'No tiene meta description')
          return res(range(d.length, 70, 160) ? 'pass' : 'partial', `${d.length} caracteres: "${d.slice(0, 90)}${d.length > 90 ? '…' : ''}"`)
        },
      },
      {
        id: 'lang',
        title: 'Idioma declarado (lang)',
        help: '<html lang="es"> ayuda a buscadores, traductores y lectores de pantalla.',
        auto: ({ site }) => {
          if (!site) return null
          const l = site.meta.lang
          return l ? res('pass', `lang="${l}"`) : res('fail', 'Falta el atributo lang en <html>')
        },
      },
      {
        id: 'open-graph',
        title: 'Open Graph completo',
        help: 'og:title, og:description, og:image y og:url definen cómo se ve el link al compartirlo en WhatsApp, Instagram, LinkedIn…',
        auto: ({ site }) => {
          if (!site) return null
          const og = site.meta.og
          const keys = ['title', 'description', 'image', 'url']
          const have = keys.filter((k) => og[k])
          const missing = keys.filter((k) => !og[k]).map((k) => `og:${k}`)
          return res(have.length === 4 ? 'pass' : have.length >= 2 ? 'partial' : 'fail', missing.length ? `Faltan: ${missing.join(', ')}` : 'Completo')
        },
      },
      {
        id: 'twitter',
        title: 'Twitter / X Card',
        help: 'twitter:card (idealmente "summary_large_image") e imagen.',
        auto: ({ site }) => {
          if (!site) return null
          const t = site.meta.twitter
          if (!t.card) return res('fail', 'No tiene twitter:card')
          return res(t.image || site.meta.og.image ? 'pass' : 'partial', `twitter:card="${t.card}"`)
        },
      },
      {
        id: 'favicon',
        title: 'Favicon e íconos',
        help: 'Ícono propio en la pestaña y apple-touch-icon para cuando se guarda en la pantalla de inicio.',
        auto: ({ site }) => {
          if (!site) return null
          const { favicon, appleTouchIcon } = site.meta
          if (!favicon) return res('fail', 'Sin favicon declarado')
          if (/vite\.svg/.test(favicon)) return res('fail', 'Usa el favicon por defecto de Vite')
          return res(appleTouchIcon ? 'pass' : 'partial', appleTouchIcon ? 'Favicon y apple-touch-icon' : 'Falta apple-touch-icon')
        },
      },
      {
        id: 'canonical',
        title: 'URL canónica',
        help: '<link rel="canonical"> evita contenido duplicado cuando la página tiene varias URLs.',
        auto: ({ site }) => (site ? (site.meta.canonical ? res('pass', site.meta.canonical) : res('fail', 'Sin link canonical')) : null),
      },
      {
        id: 'headings',
        title: 'Un único H1 y encabezados ordenados',
        help: 'Un H1 por página con el tema principal; luego H2, H3 en orden.',
        auto: ({ site }) => {
          if (!site) return null
          if (site.content.isSpaShell) return res(null, 'El HTML inicial está vacío (SPA): revisar manualmente en el navegador')
          const n = site.content.headings.h1.length
          return res(n === 1 ? 'pass' : n === 0 ? 'fail' : 'partial', n ? `${n} H1: "${site.content.headings.h1[0]}"` : 'Sin H1 en el HTML')
        },
      },
      {
        id: 'structured-data',
        title: 'Datos estructurados (JSON-LD)',
        help: 'Schema.org (Organization, WebSite, Person, Product…) ayuda a Google y a las IAs a entender la página.',
        auto: ({ site }) => (site ? (site.meta.jsonLd.length ? res('pass', `Tipos: ${site.meta.jsonLd.join(', ')}`) : res('fail', 'No tiene JSON-LD')) : null),
      },
      {
        id: 'robots',
        title: 'robots.txt',
        help: 'Archivo en la raíz que indica a los buscadores qué pueden rastrear y dónde está el sitemap.',
        auto: ({ site }) => {
          if (!site) return null
          const r = site.files.robots
          if (!r.exists) return res('fail', r.spaFallback ? 'La ruta devuelve el index.html (no existe el archivo)' : 'No existe /robots.txt')
          if (r.analysis?.blocksAll) return res('fail', 'Bloquea todo el sitio (Disallow: /)')
          return res(r.analysis?.sitemaps.length ? 'pass' : 'partial', r.analysis?.sitemaps.length ? 'Existe y declara sitemap' : 'Existe, pero no declara el sitemap')
        },
      },
      {
        id: 'sitemap',
        title: 'sitemap.xml',
        help: 'Lista de URLs del sitio para que los buscadores las descubran.',
        auto: ({ site }) => {
          if (!site) return null
          const s = site.files.sitemap
          return s.exists ? res('pass', `${s.urls} URL(s)`) : res('fail', s.spaFallback ? 'La ruta devuelve el index.html (no existe el archivo)' : 'No existe /sitemap.xml')
        },
      },
    ],
  },
  {
    id: 'geo',
    title: 'Posicionamiento en IA',
    icon: Bot,
    weight: 10,
    summary: 'Preparada para que ChatGPT, Gemini, Claude y Perplexity la entiendan y la citen (GEO).',
    criteria: [
      {
        id: 'llms-txt',
        title: 'llms.txt',
        help: 'Archivo Markdown en la raíz con un resumen del sitio y enlaces clave, pensado para modelos de lenguaje.',
        auto: ({ site }) => {
          if (!site) return null
          const f = site.files.llms
          if (!f.exists) return res('fail', f.spaFallback ? 'La ruta devuelve el index.html (no existe el archivo)' : 'No existe /llms.txt')
          const hasTitle = /^#\s+\S/m.test(f.preview || '')
          return res(hasTitle && f.bytes > 200 ? 'pass' : 'partial', `${f.lines} líneas · ${f.bytes} bytes${hasTitle ? '' : ' · falta título "# Nombre"'}`)
        },
      },
      {
        id: 'llms-full',
        title: 'llms-full.txt',
        help: 'Versión extendida con todo el contenido relevante del sitio en Markdown, para que una IA lo lea completo.',
        auto: ({ site }) => {
          if (!site) return null
          const f = site.files.llmsFull
          if (!f.exists) return res('fail', f.spaFallback ? 'La ruta devuelve el index.html (no existe el archivo)' : 'No existe /llms-full.txt')
          return res(f.bytes > 1500 ? 'pass' : 'partial', `${f.lines} líneas · ${(f.bytes / 1024).toFixed(1)} KB`)
        },
      },
      { id: 'llms-quality', title: 'Calidad del contenido para IA', help: 'Los archivos llms describen con precisión el proyecto, sin texto genérico, y coinciden con lo que muestra la web.' },
      {
        id: 'ai-crawlers',
        title: 'Permite crawlers de IA',
        help: 'robots.txt no bloquea a GPTBot, ClaudeBot, Google-Extended, PerplexityBot, etc. (salvo que sea una decisión consciente).',
        auto: ({ site }) => {
          if (!site) return null
          const a = site.files.robots.analysis
          if (!site.files.robots.exists) return res('partial', 'Sin robots.txt: se permite por defecto, pero no hay una política explícita')
          if (a?.blockedAiBots.length) return res('fail', `Bloquea: ${a.blockedAiBots.join(', ')}`)
          return res('pass', a?.mentionedAiBots.length ? `Menciona: ${a.mentionedAiBots.join(', ')}` : 'No bloquea crawlers de IA')
        },
      },
      {
        id: 'crawlable-content',
        title: 'Contenido visible sin JavaScript',
        help: 'Las apps de AI Studio son SPA: el HTML inicial llega vacío y muchos bots de IA no ejecutan JS. Solución: prerender, <noscript> con contenido o llms.txt completo.',
        auto: ({ site }) => {
          if (!site) return null
          if (!site.content.isSpaShell) return res('pass', `${site.content.visibleTextLength} caracteres de texto en el HTML inicial`)
          const hasLlms = site.files.llms.exists || site.files.llmsFull.exists
          return res(hasLlms || site.content.noscript ? 'partial' : 'fail', `HTML inicial vacío (SPA)${hasLlms ? ', compensado con archivos llms' : ''}`)
        },
      },
      { id: 'semantic', title: 'HTML semántico', help: 'Usa header, nav, main, section, article y footer en vez de solo <div>. Ayuda a IAs y lectores de pantalla.' },
    ],
  },
  {
    id: 'a11y',
    title: 'Accesibilidad',
    icon: Accessibility,
    weight: 10,
    summary: 'Cualquier persona puede usar la página, incluyendo quienes usan lector de pantalla o teclado.',
    criteria: [
      {
        id: 'a11y-score',
        title: 'Puntaje de accesibilidad ≥ 90',
        help: 'Puntaje de Lighthouse que revisa contraste, etiquetas, nombres de botones, etc.',
        auto: ({ mobile }) => {
          const v = mobile?.scores.accessibility
          if (v == null) return null
          return res(v >= 90 ? 'pass' : v >= 70 ? 'partial' : 'fail', `Accesibilidad: ${v}/100`)
        },
      },
      {
        id: 'contrast',
        title: 'Contraste de color suficiente',
        help: 'Texto legible sobre su fondo (relación 4.5:1). Ojo con texto gris claro sobre blanco.',
        auto: ({ mobile }) => (mobile?.audits.colorContrast != null ? res(mobile.audits.colorContrast === 1 ? 'pass' : 'fail', 'Auditoría de contraste (Lighthouse)') : null),
      },
      {
        id: 'alt',
        title: 'Imágenes con texto alternativo',
        help: 'Todas las imágenes informativas tienen alt descriptivo.',
        auto: ({ mobile, site }) => {
          if (mobile?.audits.imageAlt != null) return res(mobile.audits.imageAlt === 1 ? 'pass' : 'fail', 'Auditoría image-alt (Lighthouse)')
          if (site?.content.images.total) return res(site.content.images.missingAlt === 0 ? 'pass' : 'fail', `${site.content.images.missingAlt} de ${site.content.images.total} sin alt`)
          return null
        },
      },
      { id: 'keyboard', title: 'Navegable con teclado', help: 'Con Tab se recorre todo, el foco es visible y se puede usar sin mouse.' },
      { id: 'motion', title: 'Animaciones con moderación', help: 'Las animaciones no marean ni distraen, y respetan "reducir movimiento".' },
    ],
  },
  {
    id: 'quality',
    title: 'Calidad y seguridad',
    icon: ShieldCheck,
    weight: 5,
    summary: 'Detalles que distinguen un proyecto profesional de uno de prueba.',
    criteria: [
      {
        id: 'https',
        title: 'HTTPS',
        help: 'La página carga con candado (conexión segura).',
        auto: ({ site }) => (site ? res(site.https ? 'pass' : 'fail', site.https ? 'Conexión segura' : 'No usa HTTPS') : null),
      },
      {
        id: 'api-keys',
        title: 'No expone API keys',
        help: 'La API key de Gemini NUNCA debe quedar en el código del navegador: cualquiera puede copiarla y gastar tu cuota. Debe ir en un backend o función serverless.',
        auto: ({ site }) => {
          if (!site) return null
          if (site.tech.exposedKeys.length) {
            const detail = `Key(s) de Google visibles: ${site.tech.exposedKeys.join(', ')}`
            // Las keys de Firebase web son públicas por diseño; las de Gemini no.
            return site.tech.geminiInClient ? res('fail', `${detail} · usa Gemini desde el navegador`) : res('partial', `${detail} · verificar si es de Gemini (crítico) o de Firebase (aceptable con reglas de seguridad)`)
          }
          if (site.tech.geminiInClient) return res('partial', 'Llama a Gemini desde el navegador: revisar cómo se protege la key')
          return res('pass', 'No se detectaron keys en el HTML ni en los bundles')
        },
      },
      {
        id: 'console-errors',
        title: 'Sin errores en consola',
        help: 'La consola del navegador (F12) no muestra errores en rojo.',
        auto: ({ mobile }) => (mobile?.audits.errorsInConsole != null ? res(mobile.audits.errorsInConsole === 1 ? 'pass' : 'fail', 'Auditoría errors-in-console (Lighthouse)') : null),
      },
      {
        id: 'best-practices',
        title: 'Buenas prácticas ≥ 90',
        help: 'Puntaje de Lighthouse: librerías seguras, sin APIs obsoletas, imágenes con proporción correcta…',
        auto: ({ mobile }) => {
          const v = mobile?.scores['best-practices']
          if (v == null) return null
          return res(v >= 90 ? 'pass' : v >= 70 ? 'partial' : 'fail', `Buenas prácticas: ${v}/100`)
        },
      },
      {
        id: 'manifest',
        title: 'Web App Manifest',
        help: 'manifest.json con nombre, íconos y theme-color permite instalar la web como app.',
        auto: ({ site }) => {
          if (!site) return null
          const m = site.files.manifest
          if (!m.exists) return res('fail', 'Sin manifest')
          return res(m.data?.icons ? 'pass' : 'partial', m.data ? `"${m.data.name || m.data.short_name}" · ${m.data.icons} íconos` : 'Manifest inválido')
        },
      },
      { id: 'links-work', title: 'Todos los enlaces y botones funcionan', help: 'No hay links rotos, botones sin acción ni secciones "próximamente".' },
      { id: 'footer', title: 'Footer y datos de contacto', help: 'Créditos, contacto, redes y año actualizado.' },
    ],
  },
]

export const ALL_CRITERIA = CATEGORIES.flatMap((c) => c.criteria.map((cr) => ({ ...cr, categoryId: c.id })))

// Aplica las sugerencias automáticas sin pisar lo que el docente ya evaluó a mano.
export function applyAutoSuggestions(evaluations, autoResults) {
  const r = { site: autoResults?.site ?? null, mobile: autoResults?.mobile ?? null, desktop: autoResults?.desktop ?? null }
  const next = { ...evaluations }
  for (const c of ALL_CRITERIA) {
    let out = null
    try {
      out = c.auto ? c.auto(r) : null
    } catch {
      out = null
    }
    const current = next[c.id] || {}
    if (!out) {
      // Sin datos nuevos: limpia sugerencias obsoletas y estados que eran solo automáticos.
      if (current.autoDetail || current.source === 'auto') {
        const { autoStatus: _s, autoDetail: _d, ...rest } = current
        next[c.id] = current.source === 'auto' ? { ...rest, status: null, source: null } : rest
      }
      continue
    }
    const manual = current.source === 'manual'
    next[c.id] = {
      ...current,
      autoStatus: out.status,
      autoDetail: out.detail,
      ...(manual || !out.status ? {} : { status: out.status, source: 'auto' }),
    }
  }
  return next
}

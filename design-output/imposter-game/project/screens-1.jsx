// screens-1.jsx — Home, How-to, Setup screens

// Decorative kilim border element
function KilimBorder({ color, thin }) {
  const c = color || 'var(--pomegranate)';
  return (
    <svg width="100%" height={thin ? 14 : 22} viewBox="0 0 200 22" preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <pattern id={`kilim-${c.replace(/[^a-z]/gi,'')}`} x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
          <polygon points="11,2 20,11 11,20 2,11" fill="none" stroke={c} strokeWidth="2"/>
          <polygon points="11,7 15,11 11,15 7,11" fill={c}/>
        </pattern>
      </defs>
      <rect width="100%" height="22" fill={`url(#kilim-${c.replace(/[^a-z]/gi,'')})`}/>
    </svg>
  );
}

// Octagram star — Kurdish/Islamic geometric motif
function Octagram({ size = 60, color = 'currentColor', stroke = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: 'block' }}>
      <polygon points="50,2 61,39 98,50 61,61 50,98 39,61 2,50 39,39"
        fill={stroke ? 'none' : color} stroke={stroke ? color : 'none'} strokeWidth="3" />
      <polygon points="50,15 58,42 85,50 58,58 50,85 42,58 15,50 42,42"
        fill={stroke ? 'none' : color} fillOpacity={stroke ? 1 : 0.5} stroke={stroke ? color : 'none'} strokeWidth="2"
        transform="rotate(22.5 50 50)"/>
    </svg>
  );
}

// Background pattern panel (subtle kilim grid)
function KilimBg({ opacity = 0.05, color = 'var(--ink)' }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, opacity, pointerEvents: 'none',
      backgroundImage: `
        radial-gradient(circle at 0 0, ${color} 1px, transparent 1.5px),
        radial-gradient(circle at 24px 24px, ${color} 1px, transparent 1.5px)
      `,
      backgroundSize: '48px 48px',
    }} />
  );
}

// ─── HOME ────────────────────────────────────────────
function HomeScreen({ s, lang, onLang, theme, onTheme }) {
  const langs = [
    { id: 'ku', label: 'کوردی', sub: 'Kurdî' },
    { id: 'ar', label: 'العربية', sub: 'Arabic' },
    { id: 'en', label: 'English', sub: 'EN' },
  ];
  const isDark = theme === 'dark';
  return (
    <div className="app-content" style={{ position: 'relative' }}>
      <KilimBg />
      {/* Top accent + theme toggle */}
      <div style={{ padding: '8px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ color: 'var(--ink-3)', fontWeight: 600, letterSpacing: '0.18em', fontSize: 10, textTransform: 'uppercase', fontFamily: 'var(--font-ui)' }}>
            v1.0 · BETA
          </div>
          <button onClick={() => onTheme && onTheme(isDark ? 'light' : 'dark')}
            aria-label="Toggle theme"
            style={{
              border: 'none', background: 'var(--bg-2)', cursor: 'pointer',
              width: 36, height: 36, borderRadius: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--ink)',
            }}>
            {isDark
              ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="3.2" fill="currentColor"/><g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3"/></g></svg>
              : <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13 9.5A5.5 5.5 0 016.5 3a5.5 5.5 0 105.5 6.5z" fill="currentColor"/></svg>}
          </button>
        </div>
      </div>

      {/* Hero */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '0 24px', position: 'relative', textAlign: 'center' }}>
        <div style={{ position: 'absolute', top: 30, [s.dir === 'rtl' ? 'left' : 'right']: 24, color: 'var(--gold)' }}>
          <Octagram size={56} color="var(--gold)" />
        </div>
        <div style={{ position: 'absolute', top: 130, [s.dir === 'rtl' ? 'right' : 'left']: 24, color: 'var(--pomegranate)', opacity: 0.18 }}>
          <Octagram size={36} color="var(--pomegranate)" stroke />
        </div>

        <div className="eyebrow" style={{ marginBottom: 12 }}>{s.tagline}</div>
        <h1 className="h-display" style={{
          fontSize: s.dir === 'rtl' ? 48 : 72,
          color: 'var(--pomegranate)',
          margin: 0,
          lineHeight: s.dir === 'rtl' ? 1.4 : 0.95,
          textAlign: 'center',
        }}>{s.appName}</h1>
        <div style={{ height: 14 }} />
        <div style={{ width: '70%' }}>
          <KilimBorder color="var(--pomegranate)" thin />
        </div>
        <div style={{ height: 18 }} />
        <p style={{ fontSize: 15, color: 'var(--ink-2)', margin: 0, lineHeight: 1.5, maxWidth: 280, textAlign: 'center' }}>
          {lang === 'en' && '3–15 friends. One phone. One bluffer.'}
          {lang === 'ku' && '٣ تا ١٥ هاوڕێ. یەک مۆبایل. یەک فێڵباز.'}
          {lang === 'ar' && '٣–١٥ صديقًا. هاتف واحد. مخادع واحد.'}
        </p>
      </div>

      {/* Actions */}
      <div style={{ padding: '0 24px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button className="btn btn-primary" data-action="start">
          {s.newGame}
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d={s.dir === 'rtl' ? 'M13 5l-5 5 5 5' : 'M7 5l5 5-5 5'} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <button className="btn btn-ghost">{s.howToPlay}</button>
      </div>

      {/* Language switcher */}
      <div style={{ padding: '0 24px 28px' }}>
        <div className="eyebrow" style={{ marginBottom: 8, fontSize: 11 }}>{s.language}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {langs.map(l => (
            <button key={l.id} onClick={() => onLang && onLang(l.id)}
              style={{
                flex: 1, border: 'none', cursor: 'pointer',
                padding: '10px 8px', borderRadius: 14,
                background: lang === l.id ? 'var(--ink)' : 'var(--bg-2)',
                color: lang === l.id ? 'var(--bg)' : 'var(--ink)',
                fontFamily: l.id === 'en' ? 'var(--font-ui)' : 'var(--font-arabic-ui)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>{l.label}</span>
              <span style={{ fontSize: 10, opacity: 0.6, fontFamily: 'var(--font-ui)' }}>{l.sub}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── SETUP ────────────────────────────────────────────
function SetupScreen({ s, lang }) {
  const playerCount = 6;
  const imposterCount = 1;
  const seedNames = SEED_NAMES[lang].slice(0, playerCount);

  return (
    <div className="app-content">
      {/* Back nav — RTL-aware: stays visually leading */}
      <div style={{ padding: '8px 16px 0', display: 'flex' }}>
        <button style={{ width: 36, height: 36, borderRadius: 18, border: 'none', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d={s.dir === 'rtl' ? 'M5 3l5 5-5 5' : 'M11 3L6 8l5 5'} stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Title */}
      <div style={{ padding: '8px 24px 4px' }}>
        <div className="eyebrow">{s.quickStart}</div>
        <h2 className="h-display" style={{ fontSize: s.dir === 'rtl' ? 30 : 34, margin: '6px 0 0', color: 'var(--ink)' }}>{s.setup}</h2>
      </div>

      {/* Form */}
      <div style={{ flex: 1, padding: '24px 24px 16px', display: 'flex', flexDirection: 'column', gap: 22, overflow: 'auto' }}>
        {/* Players */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)' }}>{s.players}</span>
            <span className="numeric" style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, color: 'var(--pomegranate)' }}>{playerCount}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[3,4,5,6,7,8,9,10,11,12,13,14,15].map(n => (
              <div key={n} className={`chip ${n === playerCount ? 'active' : ''}`} style={{ width: 36, height: 36, fontSize: 14 }}>
                {lang === 'ar' || lang === 'ku' ? n.toString().replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]) : n}
              </div>
            ))}
          </div>
        </div>

        {/* Imposters */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)' }}>{s.imposters}</span>
            <span className="numeric" style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, color: 'var(--pomegranate)' }}>{imposterCount}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[1,2,3].map(n => (
              <div key={n} className={`chip ${n === imposterCount ? 'active' : ''}`} style={{ flex: 1, width: 'auto' }}>
                {lang === 'ar' || lang === 'ku' ? '٠١٢٣٤٥٦٧٨٩'[n] : n}
              </div>
            ))}
          </div>
        </div>

        {/* Word pack */}
        <div>
          <div style={{ marginBottom: 12, fontSize: 17, fontWeight: 600, color: 'var(--ink)' }}>{s.pack}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {Object.entries(PACKS).map(([key, p], i) => {
              const sel = i === 0;
              return (
                <div key={key} style={{
                  flex: 1, padding: 12, borderRadius: 14,
                  background: sel ? 'var(--ink)' : 'var(--bg-2)',
                  color: sel ? 'var(--bg)' : 'var(--ink)',
                  textAlign: 'center', cursor: 'pointer',
                }}>
                  <div style={{ fontSize: 22, marginBottom: 4 }}>
                    {key === 'food' ? '🍅' : key === 'places' ? '🏛' : '🎬'}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{p[lang].name}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Names */}
        <div>
          <div style={{ marginBottom: 12, fontSize: 17, fontWeight: 600, color: 'var(--ink)' }}>{s.addNames}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {seedNames.map((n, i) => (
              <div key={i} style={{
                background: 'var(--bg-2)', borderRadius: 14, padding: '12px 14px',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 14,
                  background: ['var(--pomegranate)', 'var(--indigo)', 'var(--gold)', 'var(--olive)', 'var(--pomegranate-2)', 'var(--indigo-2)'][i % 6],
                  color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-display)',
                }}>{i + 1}</div>
                <span style={{ flex: 1, fontSize: 16, color: 'var(--ink)' }}>{n}</span>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.3 }}>
                  <path d="M11 2l3 3-9 9H2v-3l9-9z" stroke="var(--ink)" strokeWidth="1.5" strokeLinejoin="round"/>
                </svg>
              </div>
            ))}
            <button style={{ background: 'transparent', border: '1.5px dashed var(--line)', borderRadius: 14, padding: '12px', color: 'var(--ink-3)', fontSize: 14, fontFamily: 'var(--font-ui)', cursor: 'pointer' }}>
              {s.addPlayer}
            </button>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: '12px 24px 24px', background: 'linear-gradient(to top, var(--bg) 60%, transparent)' }}>
        <button className="btn btn-primary" style={{ width: '100%' }}>
          {s.start}
        </button>
      </div>
    </div>
  );
}

window.HomeScreen = HomeScreen;
window.SetupScreen = SetupScreen;
window.KilimBorder = KilimBorder;
window.Octagram = Octagram;
window.KilimBg = KilimBg;

// screens-2.jsx — Pass, Reveal, Discuss screens

// ─── DEAL-PASS ────────────────────────────────────────────
function DealPassScreen({ s, lang, playerName, playerNum, total }) {
  const name = playerName || SEED_NAMES[lang][1];
  const num = playerNum || 2;
  const tot = total || 6;
  return (
    <div className="app-content" style={{ background: 'var(--indigo)', color: 'white', position: 'relative', overflow: 'hidden' }}>
      {/* Pattern bg */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.08, pointerEvents: 'none' }}>
        <svg width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
          <pattern id="pass-pat" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
            <polygon points="30,4 56,30 30,56 4,30" fill="none" stroke="white" strokeWidth="1.2" />
            <polygon points="30,18 42,30 30,42 18,30" fill="white" fillOpacity="0.5" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#pass-pat)" />
        </svg>
      </div>

      {/* Top progress */}
      <div style={{ padding: '16px 24px', display: 'flex', gap: 4, position: 'relative', zIndex: 1 }}>
        {Array.from({ length: tot }).map((_, i) =>
        <div key={i} style={{
          flex: 1, height: 3, borderRadius: 2,
          background: i < num ? 'var(--gold)' : 'rgba(255,255,255,0.2)'
        }} />
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', position: 'relative', zIndex: 1, gap: 32 }}>
        {/* Phone passing icon */}
        <div style={{ position: 'relative', width: 100, height: 100 }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: 50, background: 'rgba(255,255,255,0.06)', border: '2px solid rgba(255,255,255,0.18)' }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect x="14" y="6" width="20" height="36" rx="4" stroke="white" strokeWidth="2.5" />
              <circle cx="24" cy="36" r="1.5" fill="white" />
              <path d={s.dir === 'rtl' ? 'M38 24l4 0M40 22l-4 2 4 2' : 'M10 24l-4 0M8 22l4 2-4 2'} stroke="var(--gold)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div className="eyebrow" style={{ color: 'rgba(255,255,255,0.55)', marginBottom: 12 }}>
            {s.nextPlayer}
          </div>
          <h2 className="h-display" style={{
            fontSize: s.dir === 'rtl' ? 44 : 56, margin: 0, color: 'var(--gold)', lineHeight: 1.1
          }}>{name}</h2>
          <div style={{ marginTop: 16, fontSize: 14, color: 'rgba(255,255,255,0.55)', fontVariantNumeric: 'tabular-nums' }}>
            {lang === 'en' ? `Player ${num} of ${tot}` :
            lang === 'ku' ? `یاریزان ${num} لە ${tot}` :
            `لاعب ${num} من ${tot}`}
          </div>
        </div>
      </div>

      {/* Tap target */}
      <div style={{ padding: '0 24px 28px', position: 'relative', zIndex: 1 }}>
        <button style={{
          width: '100%', padding: '24px',
          background: 'var(--gold)', color: 'var(--indigo-2)',
          border: 'none', borderRadius: 24, cursor: 'pointer',
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          boxShadow: '0 4px 0 oklch(0.65 0.13 80), 0 12px 32px rgba(0,0,0,0.3)'
        }}>
          {s.tapToContinue}
        </button>
      </div>
    </div>);

}

// ─── DEAL-REVEAL — regular player ─────────────────────────
function DealRevealScreen({ s, lang, revealed = true, isImposter = false, word, category }) {
  const w = word || (lang === 'en' ? 'Pomegranate' : lang === 'ku' ? 'هەنار' : 'رمّان');
  const cat = category || (lang === 'en' ? 'Food' : lang === 'ku' ? 'خواردن' : 'طعام');

  if (isImposter) {
    return (
      <div className="app-content" style={{ background: 'var(--indigo-2)', color: 'white', position: 'relative', overflow: 'hidden' }}>
        {/* Warning shimmer */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 30%, oklch(0.45 0.16 25 / 0.5), transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, opacity: 0.12, pointerEvents: 'none' }}>
          <svg width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
            <pattern id="imp-pat" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
              <polygon points="40,8 72,40 40,72 8,40" fill="none" stroke="var(--pomegranate)" strokeWidth="2" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#imp-pat)" />
          </svg>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '0 28px', position: 'relative', zIndex: 1 }}>
          <div style={{ marginBottom: 24, color: 'var(--pomegranate)' }}>
            <Octagram size={56} color="var(--pomegranate)" />
          </div>
          <div className="eyebrow" style={{ color: 'oklch(0.7 0.16 25)', marginBottom: 16, fontSize: 12 }}>
            {lang === 'en' ? '— SHHH —' : lang === 'ku' ? '— وسس بە —' : '— صـه —'}
          </div>
          <h1 className="h-display" style={{
            fontSize: s.dir === 'rtl' ? 38 : 48, margin: 0, color: 'white', textAlign: 'center',
            maxWidth: 280, lineHeight: "1.5"
          }}>{s.youAreImposter}</h1>
          <div style={{ marginTop: 28, padding: '12px 18px', background: 'rgba(255,255,255,0.08)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.15)' }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', textAlign: 'center', marginBottom: 4 }}>{s.imposterHint}</div>
            <div style={{ fontSize: 22, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--gold)', textAlign: 'center' }}>{cat}</div>
          </div>
        </div>

        <div style={{ padding: '0 24px 28px', position: 'relative', zIndex: 1 }}>
          <div style={{
            width: '100%', padding: '22px',
            background: 'rgba(255,255,255,0.08)', color: 'white',
            border: '1.5px solid rgba(255,255,255,0.25)', borderRadius: 20,
            fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16,
            textAlign: 'center',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxSizing: 'border-box'
          }}>
            {s.releaseToHide}
          </div>
        </div>
      </div>);

  }

  return (
    <div className="app-content" style={{ background: 'var(--bg)', position: 'relative' }}>
      <KilimBg opacity={0.06} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '0 28px', position: 'relative' }}>
        {revealed ?
        <>
            <div className="eyebrow" style={{ marginBottom: 12 }}>{s.yourWord}</div>
            <KilimBorder color="var(--pomegranate)" thin />
            <div style={{ height: 28 }} />
            <h1 className="h-display" style={{
            fontSize: s.dir === 'rtl' ? 72 : 49,
            margin: 0, color: 'var(--pomegranate)', textAlign: 'center', lineHeight: 1.05
          }}>{w}</h1>
            <div style={{ height: 28 }} />
            <KilimBorder color="var(--pomegranate)" thin />
            <div style={{ marginTop: 28, fontSize: 14, color: 'var(--ink-3)' }}>
              {lang === 'en' ? `Category: ${cat}` : lang === 'ku' ? `پۆل: ${cat}` : `الفئة: ${cat}`}
            </div>
          </> :

        <>
            <div style={{ width: 96, height: 96, borderRadius: 48, background: 'var(--ink)', color: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <rect x="9" y="17" width="22" height="16" rx="2" stroke="currentColor" strokeWidth="2.5" />
                <path d="M14 17v-4a6 6 0 0112 0v4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
            <h2 className="h-display" style={{ fontSize: s.dir === 'rtl' ? 26 : 32, margin: 0, color: 'var(--ink)', textAlign: 'center', lineHeight: 1.2, maxWidth: 280 }}>
              {s.tapAndHold}
            </h2>
            <p style={{ marginTop: 12, fontSize: 14, color: 'var(--ink-3)', textAlign: 'center', maxWidth: 240 }}>
              {lang === 'en' ? "Make sure no one else can see" :
            lang === 'ku' ? 'دڵنیا بە کەس نایبینێت' :
            'تأكد ألا يراها أحد'}
            </p>
          </>
        }
      </div>

      <div style={{ padding: '0 24px 28px' }}>
        <button className="btn" style={{
          width: '100%', background: 'var(--ink)', color: 'var(--bg)',
          padding: '22px'
        }}>
          {revealed ? s.releaseToHide : s.tapAndHold}
        </button>
      </div>
    </div>);

}

// ─── DISCUSS ────────────────────────────────────────────
function DiscussScreen({ s, lang, secondsLeft = 87, totalSeconds = 180 }) {
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');
  const pct = secondsLeft / totalSeconds;
  const C = 2 * Math.PI * 110;

  return (
    <div className="app-content" style={{ background: 'var(--bg)', position: 'relative' }}>
      <KilimBg opacity={0.05} />

      {/* Top */}
      <div style={{ padding: '8px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="pill">
          <span style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--olive)' }} />
          {s.discuss}
        </div>
        <div className="pill">
          {lang === 'en' ? 'Round 1' : lang === 'ku' ? 'یاری ١' : 'الجولة ١'}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
        {/* Circular timer */}
        <div style={{ position: 'relative', width: 240, height: 240 }}>
          <svg width="240" height="240" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="120" cy="120" r="110" stroke="var(--bg-2)" strokeWidth="10" fill="none" />
            <circle cx="120" cy="120" r="110" stroke="var(--pomegranate)" strokeWidth="10" fill="none"
            strokeDasharray={C} strokeDashoffset={C * (1 - pct)} strokeLinecap="round" />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div className="eyebrow" style={{ marginBottom: 6, fontSize: 11 }}>{s.timeLeft}</div>
            <div className="numeric h-display" style={{ fontSize: 64, color: 'var(--ink)', letterSpacing: -0.04 }}>
              {mm}:{ss}
            </div>
          </div>
        </div>

        <p style={{ marginTop: 28, fontSize: 15, color: 'var(--ink-2)', textAlign: 'center', lineHeight: 1.5, maxWidth: 280 }}>
          {s.discussSub}
        </p>
      </div>

      {/* Active speaker queue */}
      <div style={{ padding: '0 24px 16px' }}>
        <div className="eyebrow" style={{ marginBottom: 10, fontSize: 11 }}>
          {lang === 'en' ? 'Speaking now' : lang === 'ku' ? 'ئێستا قسە دەکات' : 'يتحدث الآن'}
        </div>
        <div style={{ display: 'flex', gap: 8, overflow: 'hidden' }}>
          {SEED_NAMES[lang].slice(0, 5).map((n, i) =>
          <div key={i} style={{
            padding: '8px 12px', borderRadius: 12,
            background: i === 1 ? 'var(--ink)' : 'var(--bg-2)',
            color: i === 1 ? 'var(--bg)' : 'var(--ink-2)',
            fontSize: 13, fontWeight: i === 1 ? 600 : 500,
            whiteSpace: 'nowrap',
            opacity: i < 1 ? 0.4 : 1,
            textDecoration: i < 1 ? 'line-through' : 'none'
          }}>{n}</div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ padding: '0 24px 24px', display: 'flex', gap: 10 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }}>{s.pause}</button>
        <button className="btn btn-primary" style={{ flex: 2 }}>{s.voteNow}</button>
      </div>
    </div>);

}

window.DealPassScreen = DealPassScreen;
window.DealRevealScreen = DealRevealScreen;
window.DiscussScreen = DiscussScreen;
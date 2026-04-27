// screens-3.jsx — Vote, Reveal screens

// ─── VOTE ────────────────────────────────────────────
function VoteScreen({ s, lang, selected = 2 }) {
  const names = SEED_NAMES[lang].slice(0, 6);
  const votes = [1, 0, 3, 1, 0, 1]; // mock vote tally
  const colors = ['var(--pomegranate)', 'var(--indigo)', 'var(--gold)', 'var(--olive)', 'var(--pomegranate-2)', 'var(--indigo-2)'];

  return (
    <div className="app-content" style={{ background: 'var(--bg)', position: 'relative' }}>
      <KilimBg opacity={0.04} />

      <div style={{ padding: '8px 24px 4px' }}>
        <div className="eyebrow">{s.vote}</div>
        <h2 className="h-display" style={{ fontSize: s.dir === 'rtl' ? 26 : 32, margin: '6px 0 4px', color: 'var(--ink)', lineHeight: 1.15 }}>
          {s.votePrompt}
        </h2>
        <p style={{ fontSize: 14, color: 'var(--ink-3)', margin: 0 }}>{s.tapToVote}</p>
      </div>

      <div style={{ flex: 1, padding: '20px 16px 8px', overflow: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {names.map((n, i) => {
            const isSel = i === selected;
            return (
              <div key={i} style={{
                padding: '16px 14px',
                background: isSel ? 'var(--ink)' : 'var(--bg-2)',
                color: isSel ? 'var(--bg)' : 'var(--ink)',
                borderRadius: 18, cursor: 'pointer',
                border: isSel ? 'none' : '1.5px solid transparent',
                position: 'relative',
                minHeight: 96,
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 16,
                  background: colors[i % colors.length],
                  color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
                }}>{i + 1}</div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 600, marginTop: 8 }}>{n}</div>
                  <div style={{
                    fontSize: 11, marginTop: 4,
                    color: isSel ? 'rgba(255,255,255,0.6)' : 'var(--ink-3)',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {votes[i]} {lang === 'en' ? (votes[i] === 1 ? 'vote' : 'votes') : lang === 'ku' ? 'دەنگ' : 'صوت'}
                  </div>
                </div>
                {isSel && (
                  <div style={{
                    position: 'absolute', top: 12, right: 12,
                    width: 22, height: 22, borderRadius: 11,
                    background: 'var(--gold)', color: 'var(--ink)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ padding: '8px 24px 24px' }}>
        <button className="btn btn-primary" style={{ width: '100%' }}>
          {lang === 'en' ? 'Lock in vote' : lang === 'ku' ? 'دەنگەکە بپارێزە' : 'تأكيد الصوت'}
        </button>
      </div>
    </div>
  );
}

// ─── REVEAL ────────────────────────────────────────────
function RevealScreen({ s, lang, groupWon = true }) {
  const imposterName = SEED_NAMES[lang][2];
  const word = lang === 'en' ? 'Pomegranate' : lang === 'ku' ? 'هەنار' : 'رمّان';

  return (
    <div className="app-content" style={{
      background: groupWon ? 'var(--bg)' : 'var(--indigo-2)',
      color: groupWon ? 'var(--ink)' : 'white',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Decorative pattern */}
      <div style={{ position: 'absolute', inset: 0, opacity: groupWon ? 0.05 : 0.1, pointerEvents: 'none' }}>
        <svg width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
          <pattern id="rev-pat" x="0" y="0" width="50" height="50" patternUnits="userSpaceOnUse">
            <polygon points="25,4 46,25 25,46 4,25" fill="none" stroke={groupWon ? 'var(--pomegranate)' : 'var(--gold)'} strokeWidth="1.4"/>
            <polygon points="25,14 36,25 25,36 14,25" fill={groupWon ? 'var(--pomegranate)' : 'var(--gold)'} fillOpacity="0.4"/>
          </pattern>
          <rect width="100%" height="100%" fill="url(#rev-pat)"/>
        </svg>
      </div>

      {/* Top */}
      <div style={{ padding: '8px 24px 0', position: 'relative', zIndex: 1 }}>
        <div className="pill" style={{
          background: groupWon ? 'var(--bg-2)' : 'rgba(255,255,255,0.1)',
          color: groupWon ? 'var(--ink-2)' : 'rgba(255,255,255,0.7)',
        }}>
          {s.reveal}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 24px', position: 'relative', zIndex: 1 }}>
        {/* Verdict banner */}
        <div style={{ marginBottom: 36 }}>
          <div className="eyebrow" style={{ color: groupWon ? 'var(--olive)' : 'oklch(0.78 0.16 25)', marginBottom: 10, fontSize: 12 }}>
            {groupWon
              ? (lang === 'en' ? 'Group Wins' : lang === 'ku' ? 'گرووپ بردیەوە' : 'فاز الفريق')
              : (lang === 'en' ? 'Imposter Wins' : lang === 'ku' ? 'فێڵباز بردیەوە' : 'فاز الدخيل')}
          </div>
          <h2 className="h-display" style={{
            fontSize: s.dir === 'rtl' ? 30 : 38, margin: 0, lineHeight: 1.2,
            color: groupWon ? 'var(--ink)' : 'white',
          }}>
            {groupWon ? s.youCaughtThem : s.imposterWins}
          </h2>
        </div>

        {/* Imposter card */}
        <div style={{
          background: groupWon ? 'var(--ink)' : 'var(--pomegranate)',
          color: 'white', borderRadius: 22,
          padding: '20px 22px', marginBottom: 14,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -10, right: -10, opacity: 0.15 }}>
            <Octagram size={90} color="white" />
          </div>
          <div className="eyebrow" style={{ color: 'rgba(255,255,255,0.55)', marginBottom: 8, fontSize: 11 }}>
            {s.theImposterWas}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 22,
              background: 'var(--gold)', color: 'var(--ink)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18,
            }}>3</div>
            <div className="h-display" style={{ fontSize: s.dir === 'rtl' ? 30 : 36, color: 'white', lineHeight: 1.2 }}>{imposterName}</div>
          </div>
        </div>

        {/* Word card */}
        <div style={{
          background: groupWon ? 'var(--bg-2)' : 'rgba(255,255,255,0.08)',
          borderRadius: 22, padding: '16px 22px',
          border: groupWon ? '1.5px solid var(--line)' : '1.5px solid rgba(255,255,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div className="eyebrow" style={{ color: groupWon ? 'var(--ink-3)' : 'rgba(255,255,255,0.55)', fontSize: 11 }}>
            {s.theWordWas}
          </div>
          <div className="h-display" style={{
            fontSize: 26,
            color: groupWon ? 'var(--pomegranate)' : 'var(--gold)',
          }}>{word}</div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ padding: '20px 24px 24px', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button className="btn" style={{
          width: '100%',
          background: groupWon ? 'var(--pomegranate)' : 'var(--gold)',
          color: groupWon ? 'white' : 'var(--ink)',
          boxShadow: groupWon ? '0 4px 0 var(--pomegranate-2)' : '0 4px 0 oklch(0.65 0.13 80)',
        }}>
          {s.playAgain}
        </button>
        <button className="btn" style={{
          width: '100%',
          background: 'transparent',
          color: groupWon ? 'var(--ink-2)' : 'rgba(255,255,255,0.7)',
          border: `1.5px solid ${groupWon ? 'var(--line)' : 'rgba(255,255,255,0.2)'}`,
        }}>
          {s.home}
        </button>
      </div>
    </div>
  );
}

window.VoteScreen = VoteScreen;
window.RevealScreen = RevealScreen;

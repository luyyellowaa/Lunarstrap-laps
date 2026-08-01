import { useState, useEffect, useRef, type CSSProperties, type PointerEvent } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'info'
type AuthMode = 'login' | 'signup'

// ─── Firebase loader (compat SDK via CDN, dynamically injected) ──────────────
declare global {
  interface Window {
    firebase: any
  }
}

function useFirebase() {
  const [auth, setAuth] = useState<any>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const load = () => {
      if (window.firebase?.apps?.length) {
        const a = window.firebase.auth()
        setAuth(a)
        setReady(true)
        return
      }
      const cfg = {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
      }
      window.firebase.initializeApp(cfg)
      const a = window.firebase.auth()
      setAuth(a)
      setReady(true)
    }
    if (window.firebase) { load(); return }
    const scripts = [
      'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js',
      'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js',
    ]
    let loaded = 0
    scripts.forEach(src => {
      const s = document.createElement('script')
      s.src = src
      s.onload = () => { if (++loaded === scripts.length) load() }
      document.head.appendChild(s)
    })
  }, [])

  return { auth, ready }
}

// ─── Moon Logo ───────────────────────────────────────────────────────────────
function MoonLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="moonGrad" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#c4b5fd" />
          <stop offset="100%" stopColor="#7c3aed" />
        </radialGradient>
      </defs>
      <path
        d="M22 14.5C22 19.747 17.747 24 12.5 24C8.246 24 4.614 21.363 3.2 17.6C4.3 18.147 5.564 18.5 6.9 18.5C11.594 18.5 15.4 14.694 15.4 10C15.4 8.08 14.79 6.306 13.75 4.86C18.396 5.415 22 9.534 22 14.5Z"
        fill="url(#moonGrad)"
      />
      <circle cx="18" cy="8" r="1.2" fill="#e9d5ff" opacity="0.7" />
      <circle cx="21" cy="11" r="0.7" fill="#e9d5ff" opacity="0.5" />
      <circle cx="19.5" cy="5.5" r="0.5" fill="#e9d5ff" opacity="0.4" />
    </svg>
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, type, visible }: { msg: string; type: ToastType; visible: boolean }) {
  const colors: Record<ToastType, string> = {
    success: 'border-emerald-500/60',
    error: 'border-red-500/60',
    info: 'border-violet-500/60',
  }
  return (
    <div
      style={{ fontFamily: 'Inter, sans-serif' }}
      className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[9999] px-6 py-4 rounded-xl border
        bg-[#13151f] text-white text-sm shadow-2xl max-w-sm text-center
        transition-all duration-400 ${colors[type]}
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}
    >
      {msg}
    </div>
  )
}

// ─── Auth Modal ───────────────────────────────────────────────────────────────
function AuthModal({
  open, onClose, onSuccess,
}: {
  open: boolean
  onClose: () => void
  onSuccess: (name: string) => void
}) {
  const { auth, ready } = useFirebase()
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const reset = () => {
    setEmail(''); setPassword(''); setConfirm(''); setErr('')
  }

  const toggle = () => {
    setMode(m => m === 'login' ? 'signup' : 'login')
    reset()
  }

  const handleSubmit = async () => {
    if (!ready || !auth) { setErr('Firebase belum siap, coba lagi.'); return }
    if (!email || !password) { setErr('Vui lòng điền đầy đủ thông tin!'); return }
    if (mode === 'signup') {
      if (password !== confirm) { setErr('Mật khẩu xác nhận không khớp!'); return }
      if (password.length < 6) { setErr('Mật khẩu phải có ít nhất 6 ký tự!'); return }
    }
    setLoading(true); setErr('')
    try {
      let user: any
      if (mode === 'login') {
        const r = await auth.signInWithEmailAndPassword(email, password)
        user = r.user
      } else {
        const r = await auth.createUserWithEmailAndPassword(email, password)
        user = r.user
      }
      onSuccess(user.displayName || user.email || 'User')
      onClose(); reset()
    } catch (e: any) {
      const map: Record<string, string> = {
        'auth/email-already-in-use': 'Email này đã được đăng ký!',
        'auth/user-not-found': 'Email chưa được đăng ký!',
        'auth/wrong-password': 'Sai mật khẩu!',
        'auth/too-many-requests': 'Quá nhiều lần thử, vui lòng thử lại sau!',
        'auth/invalid-credential': 'Email hoặc mật khẩu không đúng!',
      }
      setErr(map[e.code] || e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    if (!ready || !auth) return
    setLoading(true); setErr('')
    try {
      const provider = new window.firebase.auth.GoogleAuthProvider()
      const r = await auth.signInWithPopup(provider)
      onSuccess(r.user.displayName || r.user.email || 'User')
      onClose(); reset()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="relative w-full max-w-md rounded-2xl p-8 shadow-2xl"
        style={{
          background: 'linear-gradient(145deg, #13151f, #0f1018)',
          border: '1px solid rgba(255,255,255,0.08)',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        {/* close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-5 text-slate-500 hover:text-white transition-colors text-2xl leading-none"
        >
          ×
        </button>

        {/* brand */}
        <div className="flex items-center gap-2 mb-6">
          <MoonLogo size={26} />
          <span className="font-semibold text-white" style={{ fontFamily: 'Outfit,sans-serif' }}>LunarxLauncher</span>
        </div>

        <h3 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Outfit,sans-serif' }}>
          {mode === 'login' ? 'Welcome back' : 'Create account'}
        </h3>
        <p className="text-slate-500 text-sm mb-6">
          {mode === 'login' ? 'Đăng nhập vào tài khoản của bạn' : 'Đăng ký để bắt đầu hành trình'}
        </p>

        {err && (
          <div className="mb-4 px-4 py-3 rounded-lg text-sm text-red-300 bg-red-500/10 border border-red-500/20">
            {err}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@gmail.com"
              disabled={loading}
              className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none transition-all disabled:opacity-50"
              style={{
                background: '#1a1c26',
                border: '1px solid rgba(255,255,255,0.08)',
                caretColor: '#7c3aed',
              }}
              onFocus={e => (e.target.style.borderColor = '#7c3aed')}
              onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
              className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none transition-all disabled:opacity-50"
              style={{
                background: '#1a1c26',
                border: '1px solid rgba(255,255,255,0.08)',
                caretColor: '#7c3aed',
              }}
              onFocus={e => (e.target.style.borderColor = '#7c3aed')}
              onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          {mode === 'signup' && (
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Confirm Password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none transition-all disabled:opacity-50"
                style={{
                  background: '#1a1c26',
                  border: '1px solid rgba(255,255,255,0.08)',
                  caretColor: '#7c3aed',
                }}
                onFocus={e => (e.target.style.borderColor = '#7c3aed')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
            </div>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="mt-5 w-full py-3 rounded-xl font-semibold text-white text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg,#6366f1,#7c3aed)' }}
        >
          {loading ? (mode === 'login' ? 'Đang đăng nhập...' : 'Đang đăng ký...') : (mode === 'login' ? 'Đăng nhập' : 'Đăng ký')}
        </button>

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <span className="text-xs text-slate-500">or</span>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
        </div>

        <button
          onClick={handleGoogle}
          disabled={loading}
          className="w-full py-3 rounded-xl font-semibold text-gray-900 text-sm flex items-center justify-center gap-2.5 transition-all hover:bg-gray-100 active:scale-[0.98] disabled:opacity-50"
          style={{ background: '#fff' }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#EA4335" d="M9 3.58c1.06 0 2.03.37 2.78 1.08l2.08-2.08C12.61 1.38 10.93 1 9 1 5.48 1 2.44 3.04 1 6l2.76 2.13C4.42 5.3 6.51 3.58 9 3.58z"/>
            <path fill="#4285F4" d="M17.64 9.2c0-.59-.05-1.17-.16-1.73H9v3.28h4.84c-.21 1.12-.84 2.07-1.79 2.7l2.76 2.13c1.62-1.49 2.53-3.69 2.53-6.38z"/>
            <path fill="#FBBC05" d="M3.76 10.13c-.24-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28L1 3.44C.36 4.72 0 6.16 0 7.85s.36 2.98 1 4.26l2.76-2.13z"/>
            <path fill="#34A853" d="M9 17c2.43 0 4.47-.81 5.96-2.2l-2.76-2.13c-.76.51-1.74.82-3.2.82-2.49 0-4.58-1.72-5.34-4.55L1 11.08C2.44 14.04 5.48 17 9 17z"/>
          </svg>
          Continue with Google
        </button>

        <p className="mt-4 text-center text-xs text-slate-500">
          {mode === 'login' ? 'Chưa có tài khoản? ' : 'Đã có tài khoản? '}
          <button onClick={toggle} className="text-violet-400 font-semibold hover:underline">
            {mode === 'login' ? 'Đăng ký ngay' : 'Đăng nhập'}
          </button>
        </p>
      </div>
    </div>
  )
}

// ─── Chart Bar ─────────────────────────────────────────────────────────────────
function ChartBar({ height, label, active, delay }: { height: number; label: string; active?: boolean; delay: number }) {
  const [animated, setAnimated] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setAnimated(true) }, { threshold: 0.3 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  return (
    <div ref={ref} className="flex flex-col items-center gap-2" style={{ width: 40 }}>
      <div className="relative w-full rounded-t-sm overflow-hidden" style={{ height: 100 }}>
        <div
          className="absolute bottom-0 w-full rounded-t-sm transition-all duration-1000"
          style={{
            height: animated ? `${height}%` : '0%',
            transitionDelay: `${delay}ms`,
            background: active
              ? 'linear-gradient(to top, #4c1d95, #8b5cf6)'
              : 'rgba(255,255,255,0.07)',
            boxShadow: active ? '0 0 12px rgba(124,58,237,0.5)' : 'none',
          }}
        />
      </div>
      <span className="text-[10px] text-slate-500 whitespace-nowrap" style={{ fontFamily: 'JetBrains Mono,monospace' }}>{label}</span>
    </div>
  )
}

// ─── Galaxy Mockup ─────────────────────────────────────────────────────────────
function GalaxyMockup() {
  const nodes = [
    { label: 'Fabric', orbit: 1, duration: '8s' },
    { label: 'Forge', orbit: 2, duration: '13s', reverse: true },
    { label: 'NeoForge', orbit: 3, duration: '6s' },
    { label: 'Quilt', orbit: 2, duration: '10s', offset: 180 },
    { label: 'Shaders', orbit: 1, duration: '12s', reverse: true, offset: 120 },
  ]
  return (
    <div
      className="relative flex-1 rounded-xl mt-5 overflow-hidden"
      style={{ minHeight: 240, background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.03)' }}
    >
      {/* center */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full flex items-center justify-center animate-pulse-glow z-10"
        style={{ background: 'linear-gradient(135deg,#7c3aed,#db2777)', boxShadow: '0 0 30px rgba(124,58,237,0.6)' }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
      </div>
      {/* orbit rings */}
      {[55, 80, 110].map((r, i) => (
        <div key={i} className="absolute top-1/2 left-1/2 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ width: r*2, height: r*2, border: '1px dashed rgba(255,255,255,0.04)' }} />
      ))}
      {/* nodes */}
      {nodes.map((n, i) => {
        const radii = [55, 80, 110]
        const r = radii[n.orbit - 1]
        const startAngle = (n.offset || 0) * Math.PI / 180
        const style: CSSProperties = {
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 32,
          height: 32,
          marginTop: -16,
          marginLeft: -16,
          animation: `orbit${n.orbit} ${n.duration} linear infinite ${n.reverse ? 'reverse' : ''}`,
          transformOrigin: '0 0',
        }
        return (
          <div key={i} style={style}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[8px] font-mono text-slate-400"
              style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 0 8px rgba(0,0,0,0.4)' }}>
              {n.label.slice(0,2)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Dashboard Mockup ─────────────────────────────────────────────────────────
function DashboardMockup() {
  return (
    <div
      className="w-full mt-14 rounded-2xl overflow-hidden animate-float"
      style={{
        background: '#0f1018',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 40px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(124,58,237,0.1)',
        maxWidth: 900,
        margin: '56px auto 0',
      }}
    >
      {/* title bar */}
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: '#0b0d14' }}>
        <div className="w-3 h-3 rounded-full bg-red-500/70" />
        <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
        <div className="w-3 h-3 rounded-full bg-green-500/70" />
        <span className="ml-3 text-xs text-slate-600" style={{ fontFamily: 'JetBrains Mono,monospace' }}>LunarxLauncher Beta</span>
      </div>
      <div className="flex gap-0 p-5">
        {/* sidebar */}
        <div className="flex flex-col gap-4 items-center pr-5 mr-5" style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="w-8 h-8 rounded-lg" style={{ background: 'linear-gradient(135deg,#f59e0b,#ea580c)' }} />
          {[true, false, false, false].map((active, i) => (
            <div key={i} className="w-7 h-7 rounded-lg transition-all"
              style={{
                background: active ? 'rgba(91,33,182,0.35)' : 'rgba(255,255,255,0.04)',
                border: active ? '1px solid #7c3aed' : '1px solid transparent',
              }}
            />
          ))}
        </div>
        {/* main */}
        <div className="flex-1 min-w-0">
          <div className="text-base font-bold mb-0.5" style={{ fontFamily: 'Outfit,sans-serif' }}>Time to punch some trees, Player</div>
          <div className="text-xs text-slate-600 mb-4">Your next adventure is waiting.</div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { title: 'Fabulously Optimized', bg: 'linear-gradient(135deg,#1e1b4b,#312e81)' },
              { title: 'Cobblemon Modpack', bg: 'linear-gradient(135deg,#14532d,#166534)' },
            ].map((c, i) => (
              <div key={i} className="rounded-xl h-28 flex items-end p-3.5 cursor-pointer transition-all hover:scale-[1.02]"
                style={{ background: c.bg, border: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="text-xs font-semibold text-white/90">{c.title}</span>
              </div>
            ))}
          </div>
        </div>
        {/* news */}
        <div className="w-44 ml-4 shrink-0 rounded-xl p-4" style={{ background: '#0b0d14', border: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wide">News</div>
          {[
            { title: "New on Java Realms: Sabine's Takeover", date: 'Jul 30, 2026' },
            { title: "Catch Me Outside - New Realm", date: 'Jun 15, 2026' },
            { title: "Snapshot 26w28a Released", date: 'Jun 02, 2026' },
          ].map((n, i) => (
            <div key={i} className="py-2.5" style={{ borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <p className="text-[11px] text-slate-200 font-medium leading-snug mb-1">{n.title}</p>
              <p className="text-[10px] text-slate-600" style={{ fontFamily: 'JetBrains Mono,monospace' }}>{n.date}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Scroll reveal hook ────────────────────────────────────────────────────────
function useScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal')
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) e.target.classList.add('active')
        else e.target.classList.remove('active')
      })
    }, { threshold: 0.12 })
    els.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [modalOpen, setModalOpen] = useState(false)
  const [user, setUser] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: ToastType; visible: boolean }>({ msg: '', type: 'info', visible: false })
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()

  useScrollReveal()

  const showToast = (msg: string, type: ToastType = 'info') => {
    clearTimeout(toastTimer.current)
    setToast({ msg, type, visible: true })
    toastTimer.current = setTimeout(() => setToast(t => ({ ...t, visible: false })), 4000)
  }

  const handleSuccess = (name: string) => {
    setUser(name)
    showToast(`Chào mừng, ${name}!`, 'success')
  }

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  const navLinks = [
    { label: 'Download', id: 'download' },
    { label: 'Changelog', id: 'changelog' },
    { label: 'Roadmap', id: 'roadmap' },
    { label: 'Server list', id: 'servers' },
    { label: 'Skins', id: 'skins' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#080910', fontFamily: 'Inter,sans-serif' }}>
      <Toast {...toast} />
      <AuthModal open={modalOpen} onClose={() => setModalOpen(false)} onSuccess={handleSuccess} />

      {/* ── Header ── */}
      <header
        className="fixed top-0 left-0 right-0 z-[1000] flex items-center justify-between px-10"
        style={{
          height: 64,
          background: 'rgba(8,9,16,0.8)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <button
          onClick={() => scrollTo('hero')}
          className="flex items-center gap-2.5 text-white font-bold text-lg hover:opacity-80 transition-opacity"
          style={{ fontFamily: 'Outfit,sans-serif' }}
        >
          <MoonLogo size={28} />
          LunarxLauncher
        </button>

        <nav className="hidden md:flex items-center gap-7">
          {navLinks.map(l => (
            <button
              key={l.id}
              onClick={() => scrollTo(l.id)}
              className="text-slate-400 hover:text-white text-sm font-medium transition-colors"
            >
              {l.label}
            </button>
          ))}
        </nav>

        <button
          onClick={() => {
            if (user) showToast(`Đã đăng nhập: ${user}`, 'info')
            else setModalOpen(true)
          }}
          className="text-sm font-medium px-4 py-2 rounded-lg transition-all hover:bg-white/10 active:scale-95"
          style={{
            background: user ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: user ? '#c4b5fd' : '#f1f5f9',
          }}
        >
          {user ? `${user.split('@')[0]}` : 'Sign in'}
        </button>
      </header>

      {/* ── Hero ── */}
      <section
        id="hero"
        className="relative flex flex-col items-center text-center overflow-hidden"
        style={{ paddingTop: 140, paddingBottom: 40 }}
      >
        {/* background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(91,33,182,0.25) 0%, transparent 70%)' }} />

        <div className="animate-slide-up" style={{ animationDelay: '0ms' }}>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-6"
            style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', color: '#c4b5fd', fontFamily: 'JetBrains Mono,monospace' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            Beta — A New Era Begins
          </div>
        </div>

        <h1 className="animate-slide-up font-black tracking-tight leading-none"
          style={{ fontFamily: 'Outfit,sans-serif', fontSize: 'clamp(2.8rem,6vw,5rem)', animationDelay: '80ms' }}>
          LunarxLauncher
        </h1>
        <h2 className="animate-slide-up font-bold leading-tight mt-2 mb-5"
          style={{
            fontFamily: 'Outfit,sans-serif',
            fontSize: 'clamp(2rem,4.5vw,3.6rem)',
            background: 'linear-gradient(90deg,#a78bfa,#f472b6,#a78bfa)',
            backgroundSize: '200%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            animation: 'slide-up 0.6s ease forwards, gradient 4s ease infinite',
            animationDelay: '140ms',
          }}>
          a new era begins
        </h2>

        <p className="animate-slide-up text-slate-400 max-w-xl leading-relaxed mb-8 px-4"
          style={{ fontSize: '1.05rem', animationDelay: '200ms' }}>
          Experience the next chapter of LunarxLauncher. Rebuilt around faster workflows
          for managing instances, mods, and modpacks.
        </p>

        <div className="animate-slide-up flex flex-wrap gap-3 justify-center" style={{ animationDelay: '260ms' }}>
          <a
            href="https://discord.gg/cx2HjTbrWH"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl font-semibold text-white transition-all hover:-translate-y-0.5 active:scale-95"
            style={{
              background: 'linear-gradient(135deg,#5b21b6,#4c1d95)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 4px 20px rgba(91,33,182,0.35)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            Join Discord — Coming Soon
          </a>
          <button
            onClick={() => scrollTo('features')}
            className="px-6 py-3.5 rounded-xl font-medium text-slate-300 transition-all hover:text-white hover:bg-white/5 active:scale-95"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}
          >
            See features ↓
          </button>
        </div>

        <div id="download">
          <DashboardMockup />
        </div>
      </section>

      {/* ── Changelog strip ── */}
      <div id="changelog" className="max-w-5xl mx-auto px-6 py-16">
        <div className="reveal">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-1 h-6 rounded-full" style={{ background: 'linear-gradient(to bottom,#7c3aed,#db2777)' }} />
            <h2 className="text-xl font-bold" style={{ fontFamily: 'Outfit,sans-serif' }}>Latest Changelog</h2>
            <span className="px-2 py-0.5 rounded text-xs font-mono" style={{ background: 'rgba(124,58,237,0.15)', color: '#c4b5fd', fontFamily: 'JetBrains Mono,monospace' }}>Beta</span>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { tag: 'NEW', color: '#22c55e', text: 'Complete UI redesign with new dark theme and improved navigation' },
              { tag: 'IMPROVED', color: '#3b82f6', text: 'Cold-start time reduced by 65% compared to LL 3.2' },
              { tag: 'FIXED', color: '#f59e0b', text: 'Instance isolation issues on Windows with Java 21' },
            ].map((item, i) => (
              <div key={i} className="p-4 rounded-xl" style={{ background: '#0f1018', border: '1px solid rgba(255,255,255,0.05)' }}>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: `${item.color}20`, color: item.color, fontFamily: 'JetBrains Mono,monospace' }}>
                  {item.tag}
                </span>
                <p className="text-sm text-slate-400 mt-2.5 leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Features ── */}
      <section id="features" className="max-w-5xl mx-auto px-6 pb-24">
        <div className="reveal text-center mb-12">
          <h2 className="text-3xl font-black mb-3" style={{ fontFamily: 'Outfit,sans-serif' }}>
            Everything you need, nothing you don't
          </h2>
          <p className="text-slate-500 max-w-xl mx-auto">Built for players who know what they want. Every workflow, simplified.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {/* Chart */}
          <div className="reveal delay-1 p-7 rounded-2xl flex flex-col justify-between" style={{ background: '#0f1018', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div>
              <h3 className="text-xl font-bold mb-2" style={{ fontFamily: 'Outfit,sans-serif' }}>Faster every release</h3>
              <p className="text-sm text-slate-500 mb-6">Cold-start times across generations, getting faster every release.</p>
            </div>
            <div className="flex items-end gap-4 h-28 px-4">
              <ChartBar height={85} label="LL 3.0" delay={0} />
              <ChartBar height={68} label="LL 3.1" delay={100} />
              <ChartBar height={48} label="LL 3.2" delay={200} />
              <ChartBar height={22} label="LL Beta" active delay={300} />
            </div>
          </div>

          {/* Mod galaxy */}
          <div className="reveal delay-2 p-7 rounded-2xl flex flex-col md:row-span-2" style={{ background: '#0f1018', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div>
              <h3 className="text-xl font-bold mb-2" style={{ fontFamily: 'Outfit,sans-serif' }}>Instance, mod & modpack management</h3>
              <p className="text-sm text-slate-500">Manage modpacks, mods, resource packs, and shaders from one workflow.</p>
            </div>
            <GalaxyMockup />
          </div>

          {/* versions + java */}
          <div className="reveal delay-2 grid grid-cols-2 gap-5">
            <div className="p-6 rounded-2xl flex flex-col justify-between" style={{ background: '#0f1018', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <h3 className="text-base font-bold mb-1" style={{ fontFamily: 'Outfit,sans-serif' }}>Every version, ever</h3>
                <p className="text-xs text-slate-500 mb-4">From Classic to latest Snapshot.</p>
              </div>
              <div className="space-y-1.5">
                {[{ v: 'Beta', y: '2010' }, { v: '1.20.4', y: '2024' }, { v: '1.21.5', tag: 'Latest' }].map((r, i) => (
                  <div key={i} className="flex justify-between items-center px-2.5 py-1.5 rounded-lg text-xs"
                    style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <span className="text-slate-300" style={{ fontFamily: 'JetBrains Mono,monospace' }}>{r.v}</span>
                    {r.tag ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                        style={{ background: 'rgba(56,189,248,0.12)', color: '#38bdf8', fontFamily: 'JetBrains Mono,monospace' }}>{r.tag}</span>
                    ) : (
                      <span className="text-slate-600" style={{ fontFamily: 'JetBrains Mono,monospace' }}>{r.y}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 rounded-2xl flex flex-col justify-between" style={{ background: '#0f1018', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <h3 className="text-base font-bold mb-1" style={{ fontFamily: 'Outfit,sans-serif' }}>Many setups, one launcher</h3>
                <p className="text-xs text-slate-500 mb-4">Each instance picks its own Java automatically.</p>
              </div>
              <div className="space-y-1.5">
                {[
                  { name: 'Vanilla 1.21', java: 'Java 21' },
                  { name: 'Forge 1.20', java: 'Java 17' },
                  { name: 'Legacy Beta', java: 'Java 8' },
                ].map((r, i) => (
                  <div key={i} className="flex justify-between items-center px-2.5 py-1.5 rounded-lg text-xs"
                    style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <span className="text-slate-300">{r.name}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{ background: '#1e1b4b', color: '#a78bfa', fontFamily: 'JetBrains Mono,monospace' }}>{r.java}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Roadmap ── */}
      <section id="roadmap" className="max-w-5xl mx-auto px-6 pb-24">
        <div className="reveal">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-1 h-6 rounded-full" style={{ background: 'linear-gradient(to bottom,#7c3aed,#db2777)' }} />
            <h2 className="text-xl font-bold" style={{ fontFamily: 'Outfit,sans-serif' }}>Roadmap</h2>
          </div>
          <div className="space-y-3">
            {[
              { phase: 'Q3 2026', label: 'LL 4.0 Public Beta', status: 'in-progress', note: 'Core launcher, instance management, Fabric/Forge support' },
              { phase: 'Q4 2026', label: 'LL 4.1 — Mod Browser', status: 'planned', note: 'Integrated mod marketplace with CurseForge & Modrinth' },
              { phase: 'Q1 2027', label: 'LL 4.2 — Cloud Sync', status: 'planned', note: 'Instance and world sync across devices' },
              { phase: 'TBD', label: 'LL 5.0 — Mobile Companion', status: 'concept', note: 'iOS/Android companion app for remote server management' },
            ].map((r, i) => {
              const colors: Record<string, string> = {
                'in-progress': '#22c55e',
                planned: '#3b82f6',
                concept: '#64748b',
              }
              return (
                <div key={i} className="reveal flex items-start gap-4 p-5 rounded-xl transition-all hover:bg-white/[0.02]"
                  style={{ background: '#0f1018', border: '1px solid rgba(255,255,255,0.05)', animationDelay: `${i*80}ms` }}>
                  <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: colors[r.status] }} />
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xs text-slate-500 font-mono" style={{ fontFamily: 'JetBrains Mono,monospace' }}>{r.phase}</span>
                      <span className="font-semibold text-sm" style={{ fontFamily: 'Outfit,sans-serif' }}>{r.label}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{r.note}</p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded shrink-0"
                    style={{ background: `${colors[r.status]}15`, color: colors[r.status], fontFamily: 'JetBrains Mono,monospace' }}>
                    {r.status}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Servers ── */}
      <section id="servers" className="max-w-5xl mx-auto px-6 pb-24">
        <div className="reveal">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-1 h-6 rounded-full" style={{ background: 'linear-gradient(to bottom,#7c3aed,#db2777)' }} />
            <h2 className="text-xl font-bold" style={{ fontFamily: 'Outfit,sans-serif' }}>Server List</h2>
            <span className="text-xs text-slate-600">Community favorites</span>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { name: 'Hypixel', ip: 'mc.hypixel.net', players: '72,431', game: 'Minigames', color: '#f59e0b' },
              { name: 'CubeCraft', ip: 'play.cubecraft.net', players: '28,112', game: 'Minigames', color: '#3b82f6' },
              { name: 'Mineplex', ip: 'us.mineplex.com', players: '9,840', game: 'Minigames', color: '#22c55e' },
              { name: 'FadeCloud', ip: 'fadecloud.com', players: '4,201', game: 'PvP / Factions', color: '#a855f7' },
            ].map((s, i) => (
              <div key={i} className="reveal flex items-center gap-4 p-4 rounded-xl transition-all hover:bg-white/[0.025] cursor-pointer group"
                style={{ background: '#0f1018', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black shrink-0"
                  style={{ background: `${s.color}20`, color: s.color, fontFamily: 'Outfit,sans-serif' }}>
                  {s.name[0]}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm" style={{ fontFamily: 'Outfit,sans-serif' }}>{s.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono" style={{ fontFamily: 'JetBrains Mono,monospace' }}>{s.game}</span>
                  </div>
                  <span className="text-xs text-slate-600 font-mono" style={{ fontFamily: 'JetBrains Mono,monospace' }}>{s.ip}</span>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1.5 justify-end">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    <span className="text-xs font-mono text-green-400" style={{ fontFamily: 'JetBrains Mono,monospace' }}>{s.players}</span>
                  </div>
                  <span className="text-[10px] text-slate-600">players</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Skins ── */}
      <section id="skins" className="max-w-5xl mx-auto px-6 pb-28">
        <div className="reveal">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-1 h-6 rounded-full" style={{ background: 'linear-gradient(to bottom,#7c3aed,#db2777)' }} />
            <h2 className="text-xl font-bold" style={{ fontFamily: 'Outfit,sans-serif' }}>Skin Gallery</h2>
            <span className="text-xs text-slate-600">Community uploads</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { name: 'NightRider', author: 'darkpixel', color: '#7c3aed' },
              { name: 'ArcticFox', author: 'snowcraft', color: '#38bdf8' },
              { name: 'LavaSurfer', author: 'moltencore', color: '#f97316' },
              { name: 'VoidWalker', author: 'nullspace', color: '#a855f7' },
            ].map((s, i) => (
              <div key={i} className="reveal group cursor-pointer transition-all hover:-translate-y-1"
                style={{ animationDelay: `${i*60}ms` }}>
                <div className="rounded-xl overflow-hidden mb-3 aspect-square flex items-center justify-center relative"
                  style={{ background: `linear-gradient(135deg, ${s.color}20, ${s.color}05)`, border: '1px solid rgba(255,255,255,0.06)' }}>
                  {/* pixelated skin silhouette */}
                  <div className="relative" style={{ imageRendering: 'pixelated' }}>
                    <div className="w-6 h-6 rounded-sm mb-0.5 mx-auto" style={{ background: s.color }} />
                    <div className="w-5 h-8 rounded-sm mx-auto" style={{ background: `${s.color}cc` }} />
                  </div>
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl"
                    style={{ background: 'rgba(0,0,0,0.5)' }}>
                    <span className="text-xs font-semibold text-white">Apply</span>
                  </div>
                </div>
                <p className="text-xs font-semibold text-slate-300">{s.name}</p>
                <p className="text-[10px] text-slate-600">by {s.author}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="text-center py-10 px-6" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center justify-center gap-2 mb-3">
          <MoonLogo size={20} />
          <span className="font-semibold text-sm" style={{ fontFamily: 'Outfit,sans-serif' }}>LunarxLauncher</span>
        </div>
        <p className="text-xs text-slate-600">
          &copy; 2026 LunarxLauncher. Không liên kết với Mojang Studios hoặc Microsoft.
        </p>
        <div className="flex items-center justify-center gap-5 mt-4">
          {['Discord', 'GitHub', 'Twitter'].map(l => (
            <button key={l} className="text-xs text-slate-600 hover:text-slate-400 transition-colors">{l}</button>
          ))}
        </div>
      </footer>
    </div>
  )
}
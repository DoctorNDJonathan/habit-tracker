import { useState } from 'react';
import { supabase } from './supabaseClient';

export default function Auth() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } }
      });
      if (error) {
        setMessage(error.message);
      } else {
        if (data?.user) {
          await supabase.from('profiles')
            .update({ phone })
            .eq('id', data.user.id);
        }
        setMessage('✓ Account created! Check your email to confirm, then log in.');
        setMode('login');
      }

    } else if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage(error.message);

    } else if (mode === 'reset') {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) setMessage(error.message);
      else setMessage('✓ Password reset email sent. Check your inbox.');
    }

    setLoading(false);
  }

  return (
    <div style={s.page}>
      <div style={s.box}>

        <div style={s.logoRow}>
          <span style={s.logoIcon}>🔁</span>
          <h1 style={s.logoText}>HabitLoop</h1>
        </div>
        <p style={s.tagline}>Build habits that stick</p>

        {mode !== 'reset' && (
          <div style={s.tabs}>
            {['login', 'signup'].map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setMessage(''); }}
                style={{ ...s.tab, ...(mode === m ? s.tabActive : {}) }}>
                {m === 'login' ? 'Log in' : 'Sign up'}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit}>

          {mode === 'signup' && (
            <>
              <div style={s.field}>
                <label style={s.label}>Full name</label>
                <input
                  style={s.input}
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>
              <div style={s.field}>
                <label style={s.label}>
                  WhatsApp number
                  <span style={s.optional}> — optional, for reminders</span>
                </label>
                <input
                  style={s.input}
                  type="tel"
                  placeholder="+91XXXXXXXXXX"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                />
              </div>
            </>
          )}

          {mode === 'reset' && (
            <div style={s.resetHeader}>
              <h2 style={s.resetTitle}>Reset your password</h2>
              <p style={s.resetSub}>Enter your email and we'll send you a reset link.</p>
            </div>
          )}

          <div style={s.field}>
            <label style={s.label}>Email</label>
            <input
              style={s.input}
              type="email"
              placeholder="you@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          {mode !== 'reset' && (
            <div style={s.field}>
              <label style={s.label}>Password</label>
              <input
                style={s.input}
                type="password"
                placeholder="Minimum 6 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
          )}

          {message && (
            <div style={{
              ...s.message,
              background: message.startsWith('✓') ? '#e8f5f1' : '#fdf0f0',
              color: message.startsWith('✓') ? '#16A085' : '#E74C3C',
              border: `1px solid ${message.startsWith('✓') ? '#b2dfdb' : '#f5c6c6'}`
            }}>
              {message}
            </div>
          )}

          <button type="submit" style={s.submitBtn} disabled={loading}>
            {loading ? 'Please wait...' :
              mode === 'login' ? 'Log in' :
              mode === 'signup' ? 'Create account' :
              'Send reset email'}
          </button>

        </form>

        <div style={s.footer}>
          {mode === 'login' && (
            <button style={s.linkBtn}
              onClick={() => { setMode('reset'); setMessage(''); }}>
              Forgot your password?
            </button>
          )}
          {mode === 'signup' && (
            <p style={s.footerText}>
              Already have an account?{' '}
              <button style={s.linkBtn}
                onClick={() => { setMode('login'); setMessage(''); }}>
                Log in
              </button>
            </p>
          )}
          {mode === 'reset' && (
            <button style={s.linkBtn}
              onClick={() => { setMode('login'); setMessage(''); }}>
              ← Back to login
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f0f4f3',
    fontFamily: 'system-ui, sans-serif',
    padding: '1rem'
  },
  box: {
    background: '#fff',
    borderRadius: '16px',
    padding: '2rem',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)'
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    marginBottom: '4px'
  },
  logoIcon: { fontSize: '28px' },
  logoText: {
    fontSize: '24px',
    fontWeight: '700',
    margin: 0,
    color: '#16A085'
  },
  tagline: {
    fontSize: '13px',
    color: '#888',
    textAlign: 'center',
    marginTop: 0,
    marginBottom: '1.5rem'
  },
  tabs: {
    display: 'flex',
    gap: '4px',
    background: '#f5f5f5',
    padding: '4px',
    borderRadius: '8px',
    marginBottom: '1.25rem'
  },
  tab: {
    flex: 1,
    padding: '8px',
    border: 'none',
    background: 'transparent',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#888'
  },
  tabActive: {
    background: '#fff',
    color: '#000',
    fontWeight: '500',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  field: { marginBottom: '1rem' },
  label: {
    display: 'block',
    fontSize: '13px',
    color: '#666',
    marginBottom: '5px',
    fontWeight: '500'
  },
  optional: {
    fontWeight: '400',
    color: '#aaa'
  },
  input: {
    width: '100%',
    padding: '9px 11px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    boxSizing: 'border-box',
    outline: 'none'
  },
  submitBtn: {
    width: '100%',
    padding: '11px',
    background: '#16A085',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    marginTop: '4px'
  },
  message: {
    fontSize: '13px',
    padding: '10px 12px',
    borderRadius: '8px',
    marginBottom: '12px',
    lineHeight: '1.5'
  },
  footer: {
    marginTop: '1rem',
    textAlign: 'center'
  },
  footerText: {
    fontSize: '13px',
    color: '#888',
    margin: 0
  },
  linkBtn: {
    background: 'none',
    border: 'none',
    color: '#16A085',
    fontSize: '13px',
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline'
  },
  resetHeader: {
    marginBottom: '1rem'
  },
  resetTitle: {
    fontSize: '16px',
    fontWeight: '600',
    margin: '0 0 4px'
  },
  resetSub: {
    fontSize: '13px',
    color: '#888',
    margin: 0
  }
};
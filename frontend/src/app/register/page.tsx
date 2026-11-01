'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiRequest, notifyAuthChanged } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await apiRequest('/api/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });
      await apiRequest('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      notifyAuthChanged();
      router.replace('/'); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to create your account.'); }
    finally { setBusy(false); }
  }
  return <main className="auth-page"><div className="auth-art auth-art-register"><div className="auth-art-ring"/><div className="auth-art-content"><div className="eyebrow"><span className="eyebrow-line" />YOUR SEAT IS WAITING</div><h1>Make room<br />for <em>more stories.</em></h1><p>One account. Better movie nights. A little help from your new favorite film buff.</p><div className="auth-art-caption">YOUR MOVIE NIGHT, MADE PERSONAL.</div></div></div><div className="auth-panel"><Link className="brand" href="/"><span className="brand-mark">▶</span><span>Cine<span>Mate</span></span></Link><div className="auth-panel-inner"><div className="eyebrow">JOIN THE CLUB</div><h2>Create your account</h2><p className="auth-intro">Your next great night out starts right here.</p><form className="auth-form" onSubmit={submit}><label>Your name<input autoComplete="name" required value={name} onChange={(event) => setName(event.target.value)} placeholder="Jamie Lee" /></label><label>Email address<input autoComplete="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label><label>Password<input autoComplete="new-password" type="password" minLength={10} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 10 characters" /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-accent auth-submit" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}<span>→</span></button><p className="auth-switch">Already a member? <Link href="/login">Sign in</Link></p></form></div><p className="auth-legal">By continuing, you agree to our <a href="#terms">Terms</a> and <a href="#privacy">Privacy Policy</a>.</p></div></main>;
}

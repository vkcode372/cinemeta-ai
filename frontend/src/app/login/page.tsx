'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { apiRequest, notifyAuthChanged } from '@/lib/api';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await apiRequest<{ user: { id: string; email: string } }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      notifyAuthChanged();
      const next = searchParams.get('next');
      router.replace(next?.startsWith('/') ? next : '/'); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to sign in.'); }
    finally { setBusy(false); }
  }

  return <AuthLayout eyebrow="WELCOME BACK" title={<>The previews<br /><em>were just a taste.</em></>} subtitle="Sign in to pick up where movie night left off."><form className="auth-form" onSubmit={submit}><label>Email address<input autoComplete="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label><label>Password<input autoComplete="current-password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your password" /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-accent auth-submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}<span>→</span></button><p className="auth-switch">New to CineMate? <Link href="/register">Create an account</Link></p></form></AuthLayout>;
}

export default function LoginPage() { return <Suspense><LoginForm /></Suspense>; }

function AuthLayout({ eyebrow, title, subtitle, children }: { eyebrow: string; title: React.ReactNode; subtitle: string; children: React.ReactNode }) {
  return <main className="auth-page"><div className="auth-art"><div className="auth-art-ring"/><div className="auth-art-content"><div className="eyebrow"><span className="eyebrow-line" />{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p><div className="auth-art-caption">A LITTLE MAGIC, RIGHT ON SCHEDULE.</div></div></div><div className="auth-panel"><Link className="brand" href="/"><span className="brand-mark">▶</span><span>Cine<span>Mate</span></span></Link><div className="auth-panel-inner">{children}</div><p className="auth-legal">By continuing, you agree to our <a href="#terms">Terms</a> and <a href="#privacy">Privacy Policy</a>.</p></div></main>;
}

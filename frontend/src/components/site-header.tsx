'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon } from './icon';
import { apiRequest } from '@/lib/api';

interface SignedInUser {
  id: string;
  name: string;
  email: string;
}

const links = [
  { href: '/', label: 'Discover' },
  { href: '/bookings', label: 'My bookings', private: true },
  { href: '/assistant', label: 'AI assistant', private: true },
];

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<SignedInUser | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    let latestRequest = 0;
    const refreshUser = async () => {
      const requestId = ++latestRequest;
      try {
        const profile = await apiRequest<SignedInUser>('/api/auth/me');
        if (mounted && requestId === latestRequest) setUser(profile);
      } catch {
        if (mounted && requestId === latestRequest) setUser(null);
      }
    };
    const onAuthChanged = () => { void refreshUser(); };
    void refreshUser();
    window.addEventListener('cinemate:auth-changed', onAuthChanged);
    return () => {
      mounted = false;
      window.removeEventListener('cinemate:auth-changed', onAuthChanged);
    };
  }, []);

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    window.dispatchEvent(new Event('cinemate:auth-changed'));
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="site-header">
      <div className="nav-wrap">
        <Link className="brand" href="/" aria-label="CineMate home"><span className="brand-mark"><Icon name="play" size={15} /></span><span>Cine<span>Mate</span><small> CINEMA CLUB</small></span></Link>
        <button className="mobile-menu-button" aria-label="Toggle navigation" onClick={() => setMenuOpen(!menuOpen)}><Icon name="menu" /></button>
        <nav className={menuOpen ? 'main-nav open' : 'main-nav'}>
          {links.map((link) => (link.private && !user ? null : <Link key={link.href} className={pathname === link.href ? 'nav-link active' : 'nav-link'} href={link.href} onClick={() => setMenuOpen(false)}>{link.label}</Link>))}
        </nav>
        <div className="nav-actions">
          {user && <span className="account-greeting" title={user.email}>Hi, {user.name}</span>}
          {user ? <button className="button button-quiet nav-login" onClick={signOut}>Sign out</button> : <Link className="button button-quiet nav-login" href="/login">Sign in</Link>}
          <Link className="button button-accent nav-cta" href={user ? '/assistant' : '/register'}>{user ? 'Ask CineMate' : 'Join CineMate'}<Icon name="arrow" size={16} /></Link>
        </div>
      </div>
    </header>
  );
}

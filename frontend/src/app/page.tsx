'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/icon';
import { MovieCard } from '@/components/movie-card';
import { apiRequest, type Movie } from '@/lib/api';

export default function HomePage() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams({ page: '1', limit: '20' });
    if (search) params.set('search', search);
    setLoading(true);
    void apiRequest<Movie[]>(`/api/movies/?${params}`).then(setMovies).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not load movies.')).finally(() => setLoading(false));
  }, [search]);

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(query.trim());
  }

  return (
    <main>
      <section className="hero-section">
        <div className="hero-backdrop" />
        <div className="hero-content page-shell">
          <div className="eyebrow"><span className="eyebrow-line" />YOUR NEXT MOVIE NIGHT STARTS HERE</div>
          <h1>Stories worth<br /><em>stepping into.</em></h1>
          <p>Find your next favorite. Pick your seats. Let CineMate handle the rest.</p>
          <form className="search-bar hero-search" onSubmit={submitSearch}>
            <Icon name="search" size={20} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search movies, genres, languages..." aria-label="Search movies" />
            <button type="submit" className="button button-accent">Find a film <Icon name="arrow" size={16} /></button>
          </form>
          <div className="hero-footnote"><span className="live-dot" /> CURATED FOR YOUR NEXT NIGHT OUT <span className="hero-footnote-separator">/</span> <span>NEW SHOWS ADDED WEEKLY</span></div>
        </div>
        <div className="hero-side-note">CINEMA, REIMAGINED <span>01 — 04</span></div>
      </section>

      <section className="catalog-section page-shell">
        <div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line" />THE CURRENT LINEUP</div><h2>{search ? `Results for “${search}”` : 'Now showing'}</h2></div><div className="section-heading-aside">A good film is only the beginning.<br /><span>Make a night of it.</span></div></div>
        {error ? <div className="inline-error" role="alert">{error}</div> : loading ? <div className="movie-grid">{[1, 2, 3, 4].map((key) => <div className="movie-skeleton" key={key} />)}</div> : movies.length ? <div className="movie-grid">{movies.map((movie, index) => <MovieCard key={movie.id} movie={movie} index={index} />)}</div> : <div className="empty-state"><span className="empty-orbit"><Icon name="search" size={24} /></span><h3>No films found</h3><p>Try another title, genre, or language.</p><button className="button button-outline" onClick={() => { setQuery(''); setSearch(''); }}>Clear search</button></div>}
        <div className="catalog-bottom"><span>MADE FOR THE BIG SCREEN</span><span className="catalog-rule" /><Link href="/assistant">Not sure what to watch? Ask CineMate <Icon name="arrow" size={15} /></Link></div>
      </section>

      <section className="assistant-banner page-shell"><div className="assistant-banner-icon"><Icon name="spark" size={25} /></div><div><div className="eyebrow">MEET YOUR MOVIE-WISE SIDEKICK</div><h2>Your plans have a co-star.</h2><p>Ask for movie picks, check your bookings, or find the perfect showtime.</p></div><Link className="button button-accent" href="/assistant">Chat with CineMate <Icon name="arrow" size={16} /></Link></section>
      <footer className="site-footer page-shell"><Link className="brand" href="/"><span className="brand-mark"><Icon name="play" size={15} /></span><span>Cine<span>Mate</span></span></Link><span>GOOD STORIES. GREAT COMPANY.</span><span>© 2026 CINEMATE</span></footer>
    </main>
  );
}

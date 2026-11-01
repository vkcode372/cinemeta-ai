'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/icon';
import { apiRequest, type Movie } from '@/lib/api';

export default function MovieDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { void apiRequest<Movie>(`/api/movies/${id}`).then(setMovie).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Movie could not be loaded.')); }, [id]);
  if (error) return <main className="page-shell detail-error"><div className="inline-error" role="alert">{error}</div><Link className="button button-outline" href="/">Back to movies</Link></main>;
  if (!movie) return <main className="page-shell detail-loading"><div className="movie-skeleton" /></main>;
  return <main className="page-shell detail-page"><Link className="back-link" href="/">← Back to movies</Link><section className="detail-layout"><div className="detail-poster"><span className="poster-glow"/><span className="poster-title">{movie.title.split(':')[0]}</span><span className="rating-badge"><Icon name="star" size={13}/>{Number(movie.rating).toFixed(1)}</span></div><div className="detail-copy"><div className="eyebrow"><span className="eyebrow-line"/>FEATURED FILM</div><h1>{movie.title}</h1><div className="detail-tags"><span>{movie.genre}</span><span>{movie.language}</span>{movie.durationMinutes && <span>{movie.durationMinutes} min</span>}</div><p className="detail-synopsis">{movie.synopsis || 'A story made for the big screen. Gather your favorite people and make a night of it.'}</p><div className="detail-actions"><Link className="button button-accent" href="/login">Find showtimes <Icon name="arrow" size={16}/></Link><Link className="button button-outline" href="/assistant"><Icon name="spark" size={16}/>Ask CineMate</Link></div>{movie.shows?.length ? <div className="showtime-list"><h2>Upcoming showtimes</h2>{movie.shows.map((show) => <div className="showtime-row" key={show.id}><div><strong>{new Date(show.startTime).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</strong><span>{show.cinema?.name}{show.cinema?.city ? ` · ${show.cinema.city}` : ''}</span></div><span>${show.price}</span></div>)}</div> : <p className="muted-note">Showtimes are coming soon.</p>}</div></section></main>;
}

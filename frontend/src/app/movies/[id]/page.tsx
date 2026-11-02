'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/icon';
import { apiRequest, type Booking, type Movie, type ShowAvailability } from '@/lib/api';

interface SignedInUser {
  id: string;
  name: string;
  email: string;
}

export default function MovieDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [user, setUser] = useState<SignedInUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [selectedShowId, setSelectedShowId] = useState('');
  const [availability, setAvailability] = useState<ShowAvailability | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void apiRequest<Movie>(`/api/movies/${id}`)
      .then((value) => {
        setMovie(value);
        const upcoming = value.shows?.find(
          (show) => new Date(show.startsAt).getTime() > Date.now(),
        );
        if (upcoming) setSelectedShowId(upcoming.id);
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'Movie could not be loaded.'),
      )
      .finally(() => setLoading(false));
    void apiRequest<SignedInUser>('/api/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setAuthChecked(true));
  }, [id]);

  useEffect(() => {
    if (!selectedShowId || !user) {
      setAvailability(null);
      setSelectedSeats([]);
      return;
    }
    let active = true;
    setAvailability(null);
    setSelectedSeats([]);
    void apiRequest<ShowAvailability>(`/api/bookings/shows/${selectedShowId}/seats`)
      .then((value) => {
        if (active) setAvailability(value);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error ? reason.message : 'Seat availability could not be loaded.',
          );
      });
    return () => {
      active = false;
    };
  }, [selectedShowId, user]);

  const total = useMemo(
    () => (Number(availability?.price ?? 0) * selectedSeats.length).toFixed(2),
    [availability?.price, selectedSeats.length],
  );

  function toggleSeat(seat: string) {
    setSelectedSeats((current) =>
      current.includes(seat)
        ? current.filter((entry) => entry !== seat)
        : current.length < 8
          ? [...current, seat]
          : current,
    );
  }

  async function bookSelectedSeats() {
    if (!selectedShowId || !selectedSeats.length) return;
    setBusy(true);
    setError('');
    try {
      const booking = await apiRequest<Booking>('/api/bookings/', {
        method: 'POST',
        body: JSON.stringify({ showId: selectedShowId, seats: selectedSeats }),
      });
      router.push(`/bookings/${booking.id}/confirmation`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Your booking could not be completed.');
      if (selectedShowId && user) {
        void apiRequest<ShowAvailability>(`/api/bookings/shows/${selectedShowId}/seats`)
          .then(setAvailability)
          .catch(() => undefined);
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading)
    return (
      <main className="page-shell detail-loading">
        <div className="movie-skeleton" />
      </main>
    );
  if (error && !movie)
    return (
      <main className="page-shell detail-error">
        <div className="inline-error" role="alert">
          {error}
        </div>
        <Link className="button button-outline" href="/">
          Back to movies
        </Link>
      </main>
    );
  if (!movie) return null;

  const upcomingShows = (movie.shows ?? []).filter(
    (show) => new Date(show.startsAt).getTime() > Date.now(),
  );
  const loginNext = `/login?next=${encodeURIComponent(`/movies/${id}`)}`;

  return (
    <main className="page-shell detail-page">
      <Link className="back-link" href="/">
        ← Back to movies
      </Link>
      <section className="detail-layout">
        <div className="detail-poster">
          <span className="poster-glow" />
          <span className="poster-title">{movie.title.split(':')[0]}</span>
          <span className="rating-badge">
            <Icon name="star" size={13} />
            {Number(movie.rating).toFixed(1)}
          </span>
        </div>
        <div className="detail-copy">
          <div className="eyebrow">
            <span className="eyebrow-line" />
            FEATURED FILM
          </div>
          <h1>{movie.title}</h1>
          <div className="detail-tags">
            <span>{movie.genre}</span>
            <span>{movie.language}</span>
            {movie.durationMinutes && <span>{movie.durationMinutes} min</span>}
          </div>
          <p className="detail-synopsis">
            {movie.description || 'A story made for the big screen.'}
          </p>
          <div className="detail-actions">
            <Link className="button button-outline" href="/assistant">
              <Icon name="spark" size={16} />
              Ask CineMate
            </Link>
          </div>

          {upcomingShows.length ? (
            <section className="booking-widget" aria-labelledby="showtime-heading">
              <div className="booking-widget-heading">
                <div>
                  <div className="eyebrow">
                    <span className="eyebrow-line" />
                    RESERVE YOUR SEATS
                  </div>
                  <h2 id="showtime-heading">Choose a showtime</h2>
                </div>
                <span className="demo-payment-tag">DEMO · NO CARD</span>
              </div>
              <div className="show-choice-list">
                {upcomingShows.map((show) => (
                  <button
                    key={show.id}
                    type="button"
                    className={`show-choice ${selectedShowId === show.id ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedShowId(show.id);
                      setError('');
                    }}
                  >
                    <strong>
                      {new Date(show.startsAt).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </strong>
                    <span>
                      {show.cinema?.name}
                      {show.cinema?.city ? ` · ${show.cinema.city}` : ''}
                    </span>
                    <b>${show.price}</b>
                  </button>
                ))}
              </div>
              {!authChecked ? (
                <p className="muted-note">Checking your account…</p>
              ) : !user ? (
                <div className="booking-login-note">
                  <p>Sign in to choose seats and save this booking to your account.</p>
                  <Link className="button button-accent" href={loginNext}>
                    Sign in to book <Icon name="arrow" size={16} />
                  </Link>
                </div>
              ) : (
                <>
                  {!availability ? (
                    <p className="muted-note">Loading available seats…</p>
                  ) : (
                    <>
                      <div className="screen-label">SCREEN</div>
                      <div className="seat-grid" aria-label="Choose up to eight seats">
                        {availability.seats.map((seat) => (
                          <button
                            key={seat.number}
                            type="button"
                            disabled={!seat.available}
                            aria-pressed={selectedSeats.includes(seat.number)}
                            aria-label={`Seat ${seat.number}${seat.available ? '' : ', occupied'}`}
                            className={`seat-button ${!seat.available ? 'occupied' : ''} ${selectedSeats.includes(seat.number) ? 'chosen' : ''}`}
                            onClick={() => toggleSeat(seat.number)}
                          >
                            {seat.number}
                          </button>
                        ))}
                      </div>
                      <div className="seat-legend">
                        <span>
                          <i className="seat-dot available" />
                          Available
                        </span>
                        <span>
                          <i className="seat-dot chosen" />
                          Selected
                        </span>
                        <span>
                          <i className="seat-dot occupied" />
                          Reserved
                        </span>
                      </div>
                      <div className="booking-submit-row">
                        <div>
                          <span>
                            {selectedSeats.length ? selectedSeats.join(' · ') : 'Select your seats'}
                            {selectedSeats.length >= 8 ? ' · 8 seat limit' : ''}
                          </span>
                          <strong>
                            {selectedSeats.length
                              ? `$${total} · demo checkout`
                              : `$${availability.price} per seat`}
                          </strong>
                        </div>
                        <button
                          className="button button-accent"
                          type="button"
                          onClick={() => void bookSelectedSeats()}
                          disabled={busy || !selectedSeats.length}
                        >
                          {busy ? 'Confirming…' : 'Confirm booking'} <Icon name="arrow" size={16} />
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}
              {error && (
                <p className="inline-error booking-error" role="alert">
                  {error}
                </p>
              )}
              <p className="demo-payment-copy">
                Demo checkout records a successful payment for testing. No card or payment method is
                requested.
              </p>
            </section>
          ) : (
            <p className="muted-note">Showtimes are coming soon.</p>
          )}
        </div>
      </section>
    </main>
  );
}

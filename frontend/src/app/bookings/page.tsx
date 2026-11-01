'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/icon';
import { apiRequest, type Booking } from '@/lib/api';

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  useEffect(() => { void apiRequest<Booking[]>('/api/bookings/').then(setBookings).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not load bookings.')).finally(() => setLoading(false)); }, []);
  return <main className="page-shell dashboard-page"><div className="eyebrow"><span className="eyebrow-line"/>YOUR CINE MATE ACCOUNT</div><div className="dashboard-heading"><div><h1>My bookings<span>.</span></h1><p>Your movie nights, all in one place.</p></div><Link className="button button-accent" href="/">Explore movies <Icon name="arrow" size={16}/></Link></div>
    {loading ? <div className="booking-skeleton"/> : error ? <div className="inline-error" role="alert">{error}</div> : bookings.length ? <div className="booking-list">{bookings.map((booking) => <article className="booking-card" key={booking.id}><div className="booking-icon"><Icon name="ticket" size={23}/></div><div className="booking-main"><div className="booking-title-row"><h2>{booking.show?.movie?.title ?? 'Movie booking'}</h2><span className={`status-pill status-${booking.status}`}>{booking.status}</span></div><p>{booking.show?.cinema?.name ?? 'Cinema'}{booking.show?.startTime ? ` · ${new Date(booking.show.startTime).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}` : ''}</p><div className="booking-seats">{booking.seats?.map((seat) => seat.seatNumber).join(' · ') || 'Seats pending'}</div></div><div className="booking-price"><span>TOTAL</span><strong>${booking.totalAmount}</strong></div></article>)}</div> : <div className="empty-state"><span className="empty-orbit"><Icon name="ticket" size={23}/></span><h3>No bookings yet</h3><p>Your next movie night is waiting to happen.</p><Link className="button button-accent" href="/">Browse movies</Link></div>}
  </main>;
}

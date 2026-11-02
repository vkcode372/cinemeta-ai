'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/icon';
import { apiRequest, type Booking } from '@/lib/api';

interface PaymentStatus {
  payment: { status: string; amount: string; currency: string } | null;
}

export default function BookingConfirmationPage() {
  const { id } = useParams<{ id: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [payment, setPayment] = useState<PaymentStatus['payment']>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void Promise.all([
      apiRequest<Booking>(`/api/bookings/${id}`),
      apiRequest<PaymentStatus>(`/api/payments/bookings/${id}/status`),
    ])
      .then(([bookingResult, paymentResult]) => {
        if (!active) return;
        setBooking(bookingResult);
        setPayment(paymentResult.payment);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error ? reason.message : 'Booking confirmation could not be loaded.',
          );
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (error)
    return (
      <main className="page-shell confirmation-page">
        <div className="inline-error" role="alert">
          {error}
        </div>
        <Link className="button button-outline" href="/bookings">
          Back to my bookings
        </Link>
      </main>
    );
  if (!booking)
    return (
      <main className="page-shell detail-loading">
        <div className="movie-skeleton" />
      </main>
    );

  const paymentSucceeded = payment?.status === 'succeeded';
  const startsAt = booking.show?.startsAt ? new Date(booking.show.startsAt) : null;

  return (
    <main className="page-shell confirmation-page">
      <section className="confirmation-card">
        <div className="confirmation-check">
          <Icon name="check" size={30} />
        </div>
        <div className="eyebrow">
          <span className="eyebrow-line" />
          YOUR MOVIE NIGHT IS SET
        </div>
        <h1>
          Booking confirmed<span>.</span>
        </h1>
        <p className="confirmation-intro">
          Your seats are reserved. We’ve saved this booking to your account.
        </p>
        <div className="confirmation-status">
          <span className="status-pill status-confirmed">{booking.status}</span>
          <span
            className={`status-pill ${paymentSucceeded ? 'status-confirmed' : 'status-pending'}`}
          >
            Demo payment {paymentSucceeded ? 'successful' : 'pending'}
          </span>
        </div>
        <div className="confirmation-details">
          <div>
            <span>MOVIE</span>
            <strong>{booking.show?.movie?.title ?? 'Movie booking'}</strong>
          </div>
          <div>
            <span>CINEMA & SHOWTIME</span>
            <strong>
              {booking.show?.cinema?.name ?? 'Cinema'}
              {startsAt
                ? ` · ${startsAt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`
                : ''}
            </strong>
          </div>
          <div>
            <span>SEATS</span>
            <strong>{booking.seats?.map((seat) => seat.seatNumber).join(' · ') ?? '—'}</strong>
          </div>
          <div>
            <span>DEMO TOTAL</span>
            <strong>
              {payment?.currency ?? 'USD'} {booking.totalAmount}
            </strong>
          </div>
          <div className="confirmation-reference">
            <span>BOOKING REFERENCE</span>
            <strong>{booking.id}</strong>
          </div>
        </div>
        <p className="confirmation-demo-note">
          This is a demo booking. No payment method was requested or charged; the demo payment is
          marked successful for testing.
        </p>
        <div className="confirmation-actions">
          <Link className="button button-accent" href="/bookings">
            My bookings <Icon name="arrow" size={16} />
          </Link>
          <Link className="button button-outline" href="/assistant">
            Ask CineMate about this booking <Icon name="spark" size={16} />
          </Link>
        </div>
      </section>
    </main>
  );
}

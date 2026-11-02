import { Booking, BookingSeat, Cinema, Movie, Payment, Show, sequelize } from '../models/index.js';
import { AppError } from '../errors/app-error.js';

export async function listBookings(
  userId: string,
  page: number,
  limit: number,
  status?: 'pending' | 'confirmed' | 'cancelled',
) {
  const result = await Booking.findAndCountAll({
    where: { userId, ...(status ? { status } : {}) },
    include: [
      {
        model: Show,
        as: 'show',
        include: [
          { model: Movie, as: 'movie' },
          { model: Cinema, as: 'cinema' },
        ],
      },
      { model: BookingSeat, as: 'seats' },
    ],
    limit,
    offset: (page - 1) * limit,
    order: [['createdAt', 'DESC']],
    distinct: true,
  });
  return {
    data: result.rows,
    pagination: { page, limit, total: result.count, pages: Math.ceil(result.count / limit) },
  };
}

export async function getBooking(userId: string, id: string) {
  return Booking.findOne({
    where: { id, userId },
    include: [
      {
        model: Show,
        as: 'show',
        include: [
          { model: Movie, as: 'movie' },
          { model: Cinema, as: 'cinema' },
        ],
      },
      { model: BookingSeat, as: 'seats' },
    ],
  });
}

function seatLabels(totalSeats: number): string[] {
  return Array.from(
    { length: totalSeats },
    (_, index) => `${String.fromCharCode(65 + Math.floor(index / 10))}${(index % 10) + 1}`,
  );
}

export async function getSeatAvailability(showId: string) {
  const show = await Show.findByPk(showId, {
    include: [
      { model: Movie, as: 'movie' },
      { model: Cinema, as: 'cinema' },
    ],
  });
  if (!show || new Date(String(show.get('startsAt'))).getTime() <= Date.now())
    throw new AppError('Showtime not found or no longer available', 404);
  const reserved = await BookingSeat.findAll({ where: { showId }, attributes: ['seatNumber'] });
  const reservedSeats = new Set(reserved.map((seat) => String(seat.get('seatNumber'))));
  return {
    showId,
    price: String(show.get('price')),
    totalSeats: Number(show.get('totalSeats')),
    seats: seatLabels(Number(show.get('totalSeats'))).map((number) => ({
      number,
      available: !reservedSeats.has(number),
    })),
    show: show.toJSON(),
  };
}

export async function createDemoBooking(
  userId: string,
  input: { showId: string; seats: string[] },
) {
  return sequelize.transaction(async (transaction) => {
    const show = await Show.findByPk(input.showId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!show || new Date(String(show.get('startsAt'))).getTime() <= Date.now()) {
      throw new AppError('Showtime not found or no longer available', 404);
    }
    const validSeats = new Set(seatLabels(Number(show.get('totalSeats'))));
    if (input.seats.some((seat) => !validSeats.has(seat)))
      throw new AppError('One or more selected seats are invalid', 400);
    const reservedSeats = await BookingSeat.findAll({
      where: { showId: input.showId, seatNumber: input.seats },
      attributes: ['seatNumber'],
      transaction,
    });
    if (reservedSeats.length) {
      throw new AppError(
        `These seats are no longer available: ${reservedSeats.map((seat) => seat.get('seatNumber')).join(', ')}`,
        409,
      );
    }

    const price = Number(show.get('price'));
    const totalAmount = (price * input.seats.length).toFixed(2);
    const booking = await Booking.create(
      { userId, showId: input.showId, status: 'confirmed', totalAmount },
      { transaction },
    );
    const bookingId = String(booking.get('id'));
    await BookingSeat.bulkCreate(
      input.seats.map((seatNumber) => ({
        bookingId,
        showId: input.showId,
        seatNumber,
        price: price.toFixed(2),
      })),
      { transaction },
    );
    await Payment.create(
      {
        bookingId,
        amount: totalAmount,
        currency: 'USD',
        status: 'succeeded',
        provider: 'demo-no-charge',
        providerReference: null,
      },
      { transaction },
    );

    const created = await Booking.findOne({
      where: { id: bookingId, userId },
      include: [
        {
          model: Show,
          as: 'show',
          include: [
            { model: Movie, as: 'movie' },
            { model: Cinema, as: 'cinema' },
          ],
        },
        { model: BookingSeat, as: 'seats' },
      ],
      transaction,
    });
    if (!created) throw new AppError('Booking could not be loaded after creation', 500);
    return created;
  });
}

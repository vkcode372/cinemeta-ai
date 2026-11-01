import { Booking, BookingSeat, Show } from '../models/index.js';

export async function listBookings(userId: string, page: number, limit: number) {
  const result = await Booking.findAndCountAll({
    where: { userId },
    include: [{ model: Show, as: 'show' }, { model: BookingSeat, as: 'seats' }],
    limit,
    offset: (page - 1) * limit,
    order: [['createdAt', 'DESC']],
    distinct: true,
  });
  return { data: result.rows, pagination: { page, limit, total: result.count, pages: Math.ceil(result.count / limit) } };
}

export async function getBooking(userId: string, id: string) {
  return Booking.findOne({ where: { id, userId }, include: [{ model: Show, as: 'show' }, { model: BookingSeat, as: 'seats' }] });
}

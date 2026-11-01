import { Booking, Payment } from '../models/index.js';
import { AppError } from '../errors/app-error.js';

export async function listPayments(userId: string, page: number, limit: number) {
  const result = await Payment.findAndCountAll({
    attributes: ['id', 'bookingId', 'amount', 'currency', 'status', 'createdAt'],
    include: [{ model: Booking, as: 'booking', where: { userId }, attributes: ['id', 'status'] }],
    limit,
    offset: (page - 1) * limit,
    order: [['createdAt', 'DESC']],
    distinct: true,
  });
  return { data: result.rows, pagination: { page, limit, total: result.count, pages: Math.ceil(result.count / limit) } };
}

export async function getBookingPaymentStatus(userId: string, bookingId: string) {
  const booking = await Booking.findOne({ where: { id: bookingId, userId }, attributes: ['id', 'status'] });
  if (!booking) throw new AppError('Booking not found', 404);

  const payment = await Payment.findOne({
    where: { bookingId },
    attributes: ['id', 'status', 'amount', 'currency', 'createdAt'],
    order: [['createdAt', 'DESC']],
  });
  return {
    bookingId: booking.get('id'),
    bookingStatus: booking.get('status'),
    payment: payment?.toJSON() ?? null,
  };
}

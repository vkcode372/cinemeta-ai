import { Booking, Payment } from '../models/index.js';

export async function listPayments(userId: string, page: number, limit: number) {
  const result = await Payment.findAndCountAll({
    include: [{ model: Booking, as: 'booking', where: { userId }, attributes: ['id', 'status'] }],
    limit,
    offset: (page - 1) * limit,
    order: [['createdAt', 'DESC']],
    distinct: true,
  });
  return { data: result.rows, pagination: { page, limit, total: result.count, pages: Math.ceil(result.count / limit) } };
}

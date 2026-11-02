import type { RequestHandler } from 'express';
import { AppError } from '../errors/app-error.js';
import { bookingQuerySchema, createBookingSchema } from '../validators/list.validators.js';
import * as bookings from '../services/booking.service.js';

export const list: RequestHandler = async (req, res, next) => {
  try {
    const { page, limit, status } = bookingQuerySchema.parse(req.query);
    res.json(await bookings.listBookings(req.user!.id, page, limit, status));
  } catch (error) {
    next(error);
  }
};
export const get: RequestHandler = async (req, res, next) => {
  try {
    const booking = await bookings.getBooking(req.user!.id, String(req.params.id));
    if (!booking) throw new AppError('Booking not found', 404);
    res.json({ data: booking });
  } catch (error) {
    next(error);
  }
};

export const seats: RequestHandler = async (req, res, next) => {
  try {
    res.json({ data: await bookings.getSeatAvailability(String(req.params.showId)) });
  } catch (error) {
    next(error);
  }
};

export const create: RequestHandler = async (req, res, next) => {
  try {
    const input = createBookingSchema.parse(req.body);
    const booking = await bookings.createDemoBooking(req.user!.id, input);
    res.status(201).json({ data: booking });
  } catch (error) {
    next(error);
  }
};

import type { RequestHandler } from 'express';
import { listQuerySchema } from '../validators/list.validators.js';
import * as payments from '../services/payment.service.js';

export const list: RequestHandler = async (req, res, next) => {
  try {
    const { page, limit } = listQuerySchema.parse(req.query);
    res.json(await payments.listPayments(req.user!.id, page, limit));
  } catch (error) { next(error); }
};

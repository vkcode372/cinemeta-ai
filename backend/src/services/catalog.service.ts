import { Op } from 'sequelize';
import { Movie, Show, Cinema } from '../models/index.js';

export async function listMovies(page: number, limit: number, search?: string) {
  const where = search ? { title: { [Op.iLike]: `%${search}%` } } : undefined;
  const result = await Movie.findAndCountAll({ where, limit, offset: (page - 1) * limit, order: [['title', 'ASC']] });
  return { data: result.rows, pagination: { page, limit, total: result.count, pages: Math.ceil(result.count / limit) } };
}

export async function getMovie(id: string) {
  return Movie.findByPk(id, { include: [{ model: Show, as: 'shows', include: [{ model: Cinema, as: 'cinema' }] }] });
}

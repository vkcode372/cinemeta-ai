import { Op } from 'sequelize';
import { Movie, Show, Cinema } from '../models/index.js';

export type MovieSearchFilters = { search?: string; title?: string; genre?: string; language?: string };

export async function listMovies(page: number, limit: number, filters: MovieSearchFilters = {}) {
  const clauses = [];
  if (filters.search) clauses.push({ title: { [Op.iLike]: `%${filters.search}%` } });
  if (filters.title) clauses.push({ title: { [Op.iLike]: `%${filters.title}%` } });
  if (filters.genre) clauses.push({ genre: { [Op.iLike]: `%${filters.genre}%` } });
  if (filters.language) clauses.push({ language: { [Op.iLike]: `%${filters.language}%` } });
  const where = clauses.length ? { [Op.and]: clauses } : undefined;
  const result = await Movie.findAndCountAll({ where, limit, offset: (page - 1) * limit, order: [['title', 'ASC']] });
  return { data: result.rows, pagination: { page, limit, total: result.count, pages: Math.ceil(result.count / limit) } };
}

export async function getMovie(id: string) {
  return Movie.findByPk(id, { include: [{ model: Show, as: 'shows', include: [{ model: Cinema, as: 'cinema' }] }] });
}

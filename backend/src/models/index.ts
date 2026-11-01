import { DataTypes, Model, Optional } from 'sequelize';
import type { ModelAttributes, ModelStatic } from 'sequelize';
import { sequelize } from '../config/database.js';

type BaseAttrs = { id: string; createdAt?: Date; updatedAt?: Date };
type UserAttrs = BaseAttrs & { name: string; email: string; passwordHash: string };
type MovieAttrs = BaseAttrs & { title: string; description: string; durationMinutes: number; genre: string; language: string; releaseDate: Date; rating: number; posterUrl: string | null };
type CinemaAttrs = BaseAttrs & { name: string; address: string; city: string; timezone: string };
type ShowAttrs = BaseAttrs & { movieId: string; cinemaId: string; startsAt: Date; endsAt: Date; screenName: string; totalSeats: number; price: string };
type BookingAttrs = BaseAttrs & { userId: string; showId: string; status: 'pending' | 'confirmed' | 'cancelled'; totalAmount: string };
type BookingSeatAttrs = BaseAttrs & { bookingId: string; showId: string; seatNumber: string; price: string };
type PaymentAttrs = BaseAttrs & { bookingId: string; amount: string; currency: string; status: 'pending' | 'succeeded' | 'failed' | 'refunded'; provider: string; providerReference: string | null };

type Entity<A extends BaseAttrs> = Model<A, Optional<A, 'id' | 'createdAt' | 'updatedAt'>>;

function defineModel<A extends BaseAttrs>(name: string, attributes: Omit<ModelAttributes<Entity<A>, A>, keyof BaseAttrs>): ModelStatic<Entity<A>> {
  return sequelize.define<Entity<A>>(name, {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    ...attributes,
  } as ModelAttributes<Entity<A>, A>);
}

export const User = defineModel<UserAttrs>('User', {
  name: { type: DataTypes.STRING(120), allowNull: false },
  email: { type: DataTypes.STRING(320), allowNull: false, unique: true },
  passwordHash: { type: DataTypes.STRING(255), allowNull: false, field: 'password_hash' },
});
export const Movie = defineModel<MovieAttrs>('Movie', {
  title: { type: DataTypes.STRING(200), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: false },
  durationMinutes: { type: DataTypes.INTEGER, allowNull: false, field: 'duration_minutes' },
  genre: { type: DataTypes.STRING(80), allowNull: false },
  language: { type: DataTypes.STRING(80), allowNull: false },
  releaseDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'release_date' },
  rating: { type: DataTypes.DECIMAL(2, 1), allowNull: false },
  posterUrl: { type: DataTypes.TEXT, allowNull: true, field: 'poster_url' },
});
export const Cinema = defineModel<CinemaAttrs>('Cinema', {
  name: { type: DataTypes.STRING(160), allowNull: false },
  address: { type: DataTypes.STRING(255), allowNull: false },
  city: { type: DataTypes.STRING(120), allowNull: false },
  timezone: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'UTC' },
});
export const Show = defineModel<ShowAttrs>('Show', {
  movieId: { type: DataTypes.UUID, allowNull: false, field: 'movie_id' },
  cinemaId: { type: DataTypes.UUID, allowNull: false, field: 'cinema_id' },
  startsAt: { type: DataTypes.DATE, allowNull: false, field: 'starts_at' },
  endsAt: { type: DataTypes.DATE, allowNull: false, field: 'ends_at' },
  screenName: { type: DataTypes.STRING(80), allowNull: false, field: 'screen_name' },
  totalSeats: { type: DataTypes.INTEGER, allowNull: false, field: 'total_seats' },
  price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
});
export const Booking = defineModel<BookingAttrs>('Booking', {
  userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
  showId: { type: DataTypes.UUID, allowNull: false, field: 'show_id' },
  status: { type: DataTypes.ENUM('pending', 'confirmed', 'cancelled'), allowNull: false, defaultValue: 'pending' },
  totalAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, field: 'total_amount' },
});
export const BookingSeat = defineModel<BookingSeatAttrs>('BookingSeat', {
  bookingId: { type: DataTypes.UUID, allowNull: false, field: 'booking_id' },
  showId: { type: DataTypes.UUID, allowNull: false, field: 'show_id' },
  seatNumber: { type: DataTypes.STRING(12), allowNull: false, field: 'seat_number' },
  price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
});
export const Payment = defineModel<PaymentAttrs>('Payment', {
  bookingId: { type: DataTypes.UUID, allowNull: false, field: 'booking_id' },
  amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'USD' },
  status: { type: DataTypes.ENUM('pending', 'succeeded', 'failed', 'refunded'), allowNull: false, defaultValue: 'pending' },
  provider: { type: DataTypes.STRING(80), allowNull: false },
  providerReference: { type: DataTypes.STRING(160), allowNull: true, field: 'provider_reference' },
});

User.hasMany(Booking, { foreignKey: 'userId', as: 'bookings' });
Booking.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Movie.hasMany(Show, { foreignKey: 'movieId', as: 'shows' });
Show.belongsTo(Movie, { foreignKey: 'movieId', as: 'movie' });
Cinema.hasMany(Show, { foreignKey: 'cinemaId', as: 'shows' });
Show.belongsTo(Cinema, { foreignKey: 'cinemaId', as: 'cinema' });
Show.hasMany(Booking, { foreignKey: 'showId', as: 'bookings' });
Booking.belongsTo(Show, { foreignKey: 'showId', as: 'show' });
Booking.hasMany(BookingSeat, { foreignKey: 'bookingId', as: 'seats' });
BookingSeat.belongsTo(Booking, { foreignKey: 'bookingId', as: 'booking' });
Show.hasMany(BookingSeat, { foreignKey: 'showId', as: 'reservedSeats' });
BookingSeat.belongsTo(Show, { foreignKey: 'showId', as: 'show' });
Booking.hasMany(Payment, { foreignKey: 'bookingId', as: 'payments' });
Payment.belongsTo(Booking, { foreignKey: 'bookingId', as: 'booking' });

export { sequelize };

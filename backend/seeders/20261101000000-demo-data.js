'use strict';

const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const movies = [
      ['Dune: Part Two', 'Paul Atreides unites with Chani and the Fremen while seeking revenge.', 166, 'Science Fiction', 'English', '2024-03-01', 8.5],
      ['Past Lives', 'Two childhood friends reunite years later and consider the lives they might have lived.', 106, 'Romance', 'English', '2023-06-02', 7.9],
      ['Spider-Man: Across the Spider-Verse', 'Miles Morales crosses the multiverse and meets a team of Spider-People.', 140, 'Animation', 'English', '2023-06-02', 8.6],
      ['The Grand Budapest Hotel', 'A concierge and his protégé become caught in a dispute over a valuable painting.', 99, 'Comedy', 'English', '2014-03-28', 8.1],
      ['Everything Everywhere All at Once', 'A laundromat owner is swept into an unexpected multiverse adventure.', 139, 'Adventure', 'English', '2022-03-25', 7.8],
    ].map(([title, description, duration_minutes, genre, language, release_date, rating]) => ({ id: randomUUID(), title, description, duration_minutes, genre, language, release_date, rating, poster_url: null, created_at: now, updated_at: now }));
    await queryInterface.bulkInsert('movies', movies);

    const cinemaId = randomUUID();
    await queryInterface.bulkInsert('cinemas', [{ id: cinemaId, name: 'CineMate Central', address: '100 Main Street', city: 'Austin', timezone: 'America/Chicago', created_at: now, updated_at: now }]);
    const userId = randomUUID();
    await queryInterface.bulkInsert('users', [{ id: userId, name: 'Alex Morgan', email: 'alex@example.com', password_hash: await bcrypt.hash('DemoPass123!', 10), created_at: now, updated_at: now }]);

    const showIds = movies.slice(0, 3).map(() => randomUUID());
    const startsAt = new Date(Date.now() + 86400000);
    const shows = movies.slice(0, 3).map((movie, index) => ({ id: showIds[index], movie_id: movie.id, cinema_id: cinemaId, starts_at: new Date(startsAt.getTime() + index * 3600000), ends_at: new Date(startsAt.getTime() + index * 3600000 + movie.duration_minutes * 60000), screen_name: `Screen ${index + 1}`, total_seats: 80, price: '14.50', created_at: now, updated_at: now }));
    await queryInterface.bulkInsert('shows', shows);

    const bookingId = randomUUID();
    await queryInterface.bulkInsert('bookings', [{ id: bookingId, user_id: userId, show_id: showIds[0], status: 'confirmed', total_amount: '29.00', created_at: now, updated_at: now }]);
    await queryInterface.bulkInsert('booking_seats', ['A10', 'A11'].map((seat_number) => ({ id: randomUUID(), booking_id: bookingId, show_id: showIds[0], seat_number, price: '14.50', created_at: now, updated_at: now })));
    await queryInterface.bulkInsert('payments', [{ id: randomUUID(), booking_id: bookingId, amount: '29.00', currency: 'USD', status: 'succeeded', provider: 'demo', provider_reference: 'DEMO-0001', created_at: now, updated_at: now }]);
  },
  async down(queryInterface) {
    for (const table of ['payments', 'booking_seats', 'bookings', 'shows', 'users', 'cinemas', 'movies']) await queryInterface.bulkDelete(table, null, {});
  },
};

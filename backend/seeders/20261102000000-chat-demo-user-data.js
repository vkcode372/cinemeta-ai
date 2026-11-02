'use strict';

const bcrypt = require('bcryptjs');

const userId = 'd5a70736-edca-4913-9ba9-d573dfb3477d';
const bookingIds = [
  'd5a70736-edca-4913-9ba9-d573dfb34701',
  'd5a70736-edca-4913-9ba9-d573dfb34702',
];
const seatIds = [
  'd5a70736-edca-4913-9ba9-d573dfb34711',
  'd5a70736-edca-4913-9ba9-d573dfb34712',
  'd5a70736-edca-4913-9ba9-d573dfb34713',
];
const paymentIds = [
  'd5a70736-edca-4913-9ba9-d573dfb34721',
  'd5a70736-edca-4913-9ba9-d573dfb34722',
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [users] = await queryInterface.sequelize.query('SELECT id FROM users WHERE id = :userId', { replacements: { userId } });
    if (users.length === 0) {
      const [emailOwners] = await queryInterface.sequelize.query(
        'SELECT id FROM users WHERE email = :email', { replacements: { email: 'jordan.lee@example.test' } },
      );
      if (emailOwners.length > 0) throw new Error('Demo profile email belongs to a different user; resolve the conflict before seeding.');
      await queryInterface.bulkInsert('users', [{
        id: userId,
        name: 'Jordan Lee',
        email: 'jordan.lee@example.test',
        password_hash: await bcrypt.hash('DemoPass123!', 12),
        created_at: now,
        updated_at: now,
      }]);
    }

    const [shows] = await queryInterface.sequelize.query(
      'SELECT id, price FROM shows ORDER BY starts_at ASC LIMIT 1',
    );
    if (shows.length === 0) throw new Error('No show is available. Run the demo data seeder before the chat demo data seeder.');
    const showId = shows[0].id;
    const seatPrice = String(shows[0].price);
    const total = (Number(seatPrice) * 2).toFixed(2);

    const [existingBookings] = await queryInterface.sequelize.query(
      'SELECT id FROM bookings WHERE id IN (:bookingIds)', { replacements: { bookingIds } },
    );
    if (existingBookings.length > 0) return;

    const seats = ['Z90', 'Z91', 'Z92'];
    const [occupied] = await queryInterface.sequelize.query(
      'SELECT seat_number FROM booking_seats WHERE show_id = :showId AND seat_number IN (:seats)',
      { replacements: { showId, seats } },
    );
    const occupiedSeats = new Set(occupied.map((row) => row.seat_number));
    const available = seats.filter((seat) => !occupiedSeats.has(seat));
    if (available.length < 3) throw new Error('Could not find three free demo seats for the chat demo user.');

    await queryInterface.bulkInsert('bookings', [
      { id: bookingIds[0], user_id: userId, show_id: showId, status: 'confirmed', total_amount: total, created_at: now, updated_at: now },
      { id: bookingIds[1], user_id: userId, show_id: showId, status: 'pending', total_amount: seatPrice, created_at: now, updated_at: now },
    ]);
    await queryInterface.bulkInsert('booking_seats', [
      { id: seatIds[0], booking_id: bookingIds[0], show_id: showId, seat_number: available[0], price: seatPrice, created_at: now, updated_at: now },
      { id: seatIds[1], booking_id: bookingIds[0], show_id: showId, seat_number: available[1], price: seatPrice, created_at: now, updated_at: now },
      { id: seatIds[2], booking_id: bookingIds[1], show_id: showId, seat_number: available[2], price: seatPrice, created_at: now, updated_at: now },
    ]);
    await queryInterface.bulkInsert('payments', [
      { id: paymentIds[0], booking_id: bookingIds[0], amount: total, currency: 'USD', status: 'succeeded', provider: 'demo', provider_reference: 'CHAT-DEMO-PAID-001', created_at: now, updated_at: now },
      { id: paymentIds[1], booking_id: bookingIds[1], amount: seatPrice, currency: 'USD', status: 'pending', provider: 'demo', provider_reference: null, created_at: now, updated_at: now },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('payments', { id: paymentIds });
    await queryInterface.bulkDelete('booking_seats', { id: seatIds });
    await queryInterface.bulkDelete('bookings', { id: bookingIds });
    await queryInterface.bulkDelete('users', { id: userId, email: 'jordan.lee@example.test' });
  },
};

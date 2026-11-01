import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { app } from '../src/app.js';
import { sequelize, User, Movie, Cinema, Show, Booking, BookingSeat, Payment } from '../src/models/index.js';

describe('API integration', () => {
  const testEmail = `integration-${randomUUID()}@example.test`;
  let token: string;
  let movieId: string;
  let bookingId: string;
  let cinemaId: string;
  let showId: string;
  let databaseReady = false;

  beforeAll(async () => {
    await sequelize.sync();
    databaseReady = true;
    process.env.JWT_SECRET = 'integration-test-secret-at-least-32-characters';
  });
  afterAll(async () => {
    if (databaseReady) {
      const user = await User.findOne({ where: { email: testEmail } });
      if (user) await Booking.destroy({ where: { userId: String(user.get('id')) } });
      if (showId) await Show.destroy({ where: { id: showId } });
      if (cinemaId) await Cinema.destroy({ where: { id: cinemaId } });
      if (movieId) await Movie.destroy({ where: { id: movieId } });
      if (user) await User.destroy({ where: { id: String(user.get('id')) } });
    }
    await sequelize.close();
  });

  it('registers and logs in, rejecting invalid input', async () => {
    const invalid = await request(app).post('/api/auth/register').send({ email: 'bad', password: 'x' });
    expect(invalid.status).toBe(400);
    const created = await request(app).post('/api/auth/register').send({ name: 'Test User', email: testEmail, password: 'Password123!' });
    expect(created.status).toBe(201);
    expect(created.body.data).not.toHaveProperty('passwordHash');
    const loggedIn = await request(app).post('/api/auth/login').send({ email: testEmail, password: 'Password123!' });
    expect(loggedIn.status).toBe(200);
    token = loggedIn.body.data.token;
    expect((await request(app).post('/api/auth/login').send({ email: testEmail, password: 'wrong-password' })).status).toBe(401);
  });

  it('lists and retrieves movies and validates IDs', async () => {
    const movie = await Movie.create({ title: 'Integration Feature', description: 'A sample movie for API integration.', durationMinutes: 110, genre: 'Drama', language: 'English', releaseDate: new Date('2025-01-01'), rating: 7.5 });
    movieId = String(movie.get('id'));
    const list = await request(app).get('/api/movies?page=1&limit=10&search=Integration%20Feature');
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect((await request(app).get(`/api/movies/${movieId}`)).body.data.title).toBe('Integration Feature');
    expect((await request(app).get('/api/movies/nope')).status).toBe(400);
  });

  it('protects and returns current user bookings and payments', async () => {
    expect((await request(app).get('/api/bookings')).status).toBe(401);
    const cinema = await Cinema.create({ name: 'Test Cinema', address: '1 Test Way', city: 'Austin', timezone: 'America/Chicago' });
    cinemaId = String(cinema.get('id'));
    const show = await Show.create({ movieId, cinemaId: String(cinema.get('id')), startsAt: new Date(Date.now() + 86400000), endsAt: new Date(Date.now() + 90000000), screenName: 'Screen 1', totalSeats: 80, price: '12.50' });
    showId = String(show.get('id'));
    const user = await User.findOne({ where: { email: testEmail } });
    const booking = await Booking.create({ userId: String(user!.get('id')), showId, status: 'confirmed', totalAmount: '12.50' });
    bookingId = String(booking.get('id'));
    await BookingSeat.create({ bookingId, showId, seatNumber: 'A1', price: '12.50' });
    await Payment.create({ bookingId, amount: '12.50', currency: 'USD', status: 'succeeded', provider: 'test', providerReference: 'TEST-1' });
    const bookings = await request(app).get('/api/bookings').set('Authorization', `Bearer ${token}`);
    expect(bookings.status).toBe(200);
    expect(bookings.body.data).toHaveLength(1);
    expect((await request(app).get(`/api/bookings/${bookingId}`).set('Authorization', `Bearer ${token}`)).status).toBe(200);
    expect((await request(app).get('/api/payments/').set('Authorization', `Bearer ${token}`)).body.data).toHaveLength(1);
    expect((await request(app).get(`/api/bookings/${bookingId}`).set('Authorization', 'Bearer invalid')).status).toBe(401);
  });
});

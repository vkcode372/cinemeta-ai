'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    // Sequelize generates UUIDs in the application; this avoids requiring a PostgreSQL UUID extension.
    const id = { type: DataTypes.UUID, allowNull: false, primaryKey: true };
    const timestamps = { created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }, updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW } };
    await queryInterface.createTable('users', { id, name: { type: DataTypes.STRING(120), allowNull: false }, email: { type: DataTypes.STRING(320), allowNull: false, unique: true }, password_hash: { type: DataTypes.STRING(255), allowNull: false }, ...timestamps });
    await queryInterface.createTable('movies', { id, title: { type: DataTypes.STRING(200), allowNull: false }, description: { type: DataTypes.TEXT, allowNull: false }, duration_minutes: { type: DataTypes.INTEGER, allowNull: false }, genre: { type: DataTypes.STRING(80), allowNull: false }, language: { type: DataTypes.STRING(80), allowNull: false }, release_date: { type: DataTypes.DATEONLY, allowNull: false }, rating: { type: DataTypes.DECIMAL(2, 1), allowNull: false }, poster_url: { type: DataTypes.TEXT }, ...timestamps });
    await queryInterface.createTable('cinemas', { id, name: { type: DataTypes.STRING(160), allowNull: false }, address: { type: DataTypes.STRING(255), allowNull: false }, city: { type: DataTypes.STRING(120), allowNull: false }, timezone: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'UTC' }, ...timestamps });
    await queryInterface.createTable('shows', { id, movie_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'movies', key: 'id' }, onDelete: 'CASCADE' }, cinema_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'cinemas', key: 'id' }, onDelete: 'CASCADE' }, starts_at: { type: DataTypes.DATE, allowNull: false }, ends_at: { type: DataTypes.DATE, allowNull: false }, screen_name: { type: DataTypes.STRING(80), allowNull: false }, total_seats: { type: DataTypes.INTEGER, allowNull: false }, price: { type: DataTypes.DECIMAL(10, 2), allowNull: false }, ...timestamps });
    await queryInterface.createTable('bookings', { id, user_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' }, show_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'shows', key: 'id' }, onDelete: 'RESTRICT' }, status: { type: DataTypes.ENUM('pending', 'confirmed', 'cancelled'), allowNull: false, defaultValue: 'pending' }, total_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false }, ...timestamps });
    await queryInterface.createTable('booking_seats', { id, booking_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'bookings', key: 'id' }, onDelete: 'CASCADE' }, show_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'shows', key: 'id' }, onDelete: 'CASCADE' }, seat_number: { type: DataTypes.STRING(12), allowNull: false }, price: { type: DataTypes.DECIMAL(10, 2), allowNull: false }, ...timestamps });
    await queryInterface.createTable('payments', { id, booking_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'bookings', key: 'id' }, onDelete: 'CASCADE' }, amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false }, currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'USD' }, status: { type: DataTypes.ENUM('pending', 'succeeded', 'failed', 'refunded'), allowNull: false, defaultValue: 'pending' }, provider: { type: DataTypes.STRING(80), allowNull: false }, provider_reference: { type: DataTypes.STRING(160) }, ...timestamps });
    await queryInterface.addIndex('shows', ['movie_id']);
    await queryInterface.addIndex('shows', ['cinema_id', 'starts_at']);
    await queryInterface.addIndex('bookings', ['user_id', 'created_at']);
    await queryInterface.addIndex('bookings', ['show_id']);
    await queryInterface.addIndex('booking_seats', ['show_id', 'seat_number'], { unique: true });
    await queryInterface.addIndex('booking_seats', ['booking_id']);
    await queryInterface.addIndex('payments', ['booking_id']);
  },
  async down(queryInterface) {
    for (const table of ['payments', 'booking_seats', 'bookings', 'shows', 'cinemas', 'movies', 'users']) await queryInterface.dropTable(table);
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_bookings_status"; DROP TYPE IF EXISTS "enum_payments_status";');
  },
};

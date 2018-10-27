import PGMigrate from 'node-pg-migrate';
import PG from 'pg';
import path from 'path';
import packageJSON from '../package';

export default class DB {
  constructor() {
    this.connectionOptions = {
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'meme',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      port: 5432,
    };
  }

  // Queries

  async getVKPublics() {
    const data = await this.db.query('SELECT * from vk_publics');
    return data;
  }

  async updateVKLastViewedPost(vkPublic, timestamp) {
    const data = await this.db.query(
      `
      UPDATE vk_publics
      SET last_viewed_post_date = to_timestamp(${timestamp})
      WHERE url = '${vkPublic}'
      `
    );
    return data;
  }

  // DB

  async connect() {
    console.info('Start migrations...');
    await this.migrations();
    console.info('Connect to data base....');
    this.dbConnect();
    console.info('Successfully connected to db!');
    return this.db;
  }

  dbConnect() {
    this.db = new PG.Pool(this.connectionOptions);
  }

  async migrations() {
    await PGMigrate.default({
      databaseUrl: this.connectionOptions,
      migrationsTable: 'migrations',
      direction: 'up',
      file: packageJSON.version,
      dir: path.resolve('./migrations'),
    });
  }
}

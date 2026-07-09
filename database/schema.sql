CREATE TABLE users (
 id SERIAL PRIMARY KEY,
 email TEXT UNIQUE NOT NULL,
 password_hash TEXT NOT NULL
);

CREATE TABLE devices (
 id SERIAL PRIMARY KEY,
 user_id INTEGER,
 name TEXT,
 status TEXT,
 last_seen TIMESTAMP
);

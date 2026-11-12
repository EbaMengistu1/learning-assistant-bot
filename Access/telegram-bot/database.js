const { Pool } = require("pg");

let pool = null;

function getPool() {
  if (pool) {
    return pool;
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("DATABASE_URL is missing in Railway Variables.");
    return null;
  }

  pool = new Pool({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false
    }
  });

  return pool;
}

async function createTables() {
  const db = getPool();

  if (!db) {
    return;
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      chat_id TEXT PRIMARY KEY,
      first_name TEXT,
      username TEXT,
      role TEXT DEFAULT 'student',
      phone TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS progress (
      chat_id TEXT,
      lesson_title TEXT,
      completed_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (chat_id, lesson_title)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS help_requests (
      id SERIAL PRIMARY KEY,
      chat_id TEXT,
      question TEXT,
      status TEXT DEFAULT 'open',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS accommodation_requests (
      id SERIAL PRIMARY KEY,
      chat_id TEXT,
      accommodation TEXT,
      status TEXT DEFAULT 'open',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS screen_share_requests (
      id SERIAL PRIMARY KEY,
      chat_id TEXT,
      meeting_link TEXT,
      status TEXT DEFAULT 'open',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      teacher_chat_id TEXT,
      student_chat_id TEXT,
      message TEXT,
      channel TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS announcements (
      id SERIAL PRIMARY KEY,
      teacher_chat_id TEXT,
      message TEXT,
      channel TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  console.log("Database tables are ready.");
}

async function saveUser(user) {
  const db = getPool();

  if (!db) {
    return;
  }

  await db.query(
    `
    INSERT INTO users (chat_id, first_name, username, role)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (chat_id)
    DO UPDATE SET
      first_name = EXCLUDED.first_name,
      username = EXCLUDED.username,
      role = EXCLUDED.role
    `,
    [
      String(user.chatId),
      user.firstName || null,
      user.username || null,
      user.role || "student"
    ]
  );
}

async function savePhone(chatId, phone) {
  const db = getPool();

  if (!db) {
    return;
  }

  await db.query(
    `
    UPDATE users
    SET phone = $1
    WHERE chat_id = $2
    `,
    [phone, String(chatId)]
  );
}

async function getPhone(chatId) {
  const db = getPool();

  if (!db) {
    return null;
  }

  const result = await db.query(
    `
    SELECT phone
    FROM users
    WHERE chat_id = $1
    `,
    [String(chatId)]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0].phone;
}

async function getAllStudents() {
  const db = getPool();

  if (!db) {
    return [];
  }

  const result = await db.query(
    `
    SELECT chat_id, first_name, username, phone
    FROM users
    WHERE role = 'student'
    ORDER BY created_at DESC
    `
  );

  return result.rows;
}

async function saveProgress(chatId, lessonTitle) {
  const db = getPool();

  if (!db) {
    return;
  }

  await db.query(
    `
    INSERT INTO progress (chat_id, lesson_title)
    VALUES ($1, $2)
    ON CONFLICT (chat_id, lesson_title)
    DO NOTHING
    `,
    [String(chatId), lessonTitle]
  );
}

async function getProgress(chatId) {
  const db = getPool();

  if (!db) {
    return [];
  }

  const result = await db.query(
    `
    SELECT lesson_title
    FROM progress
    WHERE chat_id = $1
    ORDER BY completed_at ASC
    `,
    [String(chatId)]
  );

  return result.rows.map(row => row.lesson_title);
}

async function saveHelpRequest(chatId, question) {
  const db = getPool();

  if (!db) {
    return;
  }

  await db.query(
    `
    INSERT INTO help_requests (chat_id, question)
    VALUES ($1, $2)
    `,
    [String(chatId), question]
  );
}

async function saveAccommodationRequest(chatId, accommodation) {
  const db = getPool();

  if (!db) {
    return;
  }

  await db.query(
    `
    INSERT INTO accommodation_requests (chat_id, accommodation)
    VALUES ($1, $2)
    `,
    [String(chatId), accommodation]
  );
}

async function saveScreenShareRequest(chatId, meetingLink) {
  const db = getPool();

  if (!db) {
    return;
  }

  await db.query(
    `
    INSERT INTO screen_share_requests (chat_id, meeting_link)
    VALUES ($1, $2)
    `,
    [String(chatId), meetingLink]
  );
}

async function saveMessage(
  teacherChatId,
  studentChatId,
  message,
  channel
) {
  const db = getPool();

  if (!db) {
    return;
  }

  await db.query(
    `
    INSERT INTO messages
    (teacher_chat_id, student_chat_id, message, channel)
    VALUES ($1, $2, $3, $4)
    `,
    [
      String(teacherChatId),
      String(studentChatId),
      message,
      channel
    ]
  );
}

async function saveAnnouncement(
  teacherChatId,
  message,
  channel
) {
  const db = getPool();

  if (!db) {
    return;
  }

  await db.query(
    `
    INSERT INTO announcements
    (teacher_chat_id, message, channel)
    VALUES ($1, $2, $3)
    `,
    [String(teacherChatId), message, channel]
  );
}

module.exports = {
  createTables,
  saveUser,
  savePhone,
  getPhone,
  getAllStudents,
  saveProgress,
  getProgress,
  saveHelpRequest,
  saveAccommodationRequest,
  saveScreenShareRequest,
  saveMessage,
  saveAnnouncement
};
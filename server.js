const express = require("express");
const cors = require("cors");

const db = require("./database");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get("/", (req, res) => {
  res.json({
    status: "Track 3 API is running",
    version: "v1"
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    database: Boolean(process.env.DATABASE_URL)
  });
});

app.get("/api/students", async (req, res) => {
  try {
    const students = await db.getAllStudents();

    res.json({
      success: true,
      students: students
    });
  } catch (error) {
    console.error("Get students failed:", error.message);

    res.status(500).json({
      success: false,
      error: "Could not load students"
    });
  }
});

app.get("/api/progress/:chatId", async (req, res) => {
  try {
    const chatId = req.params.chatId;
    const progress = await db.getProgress(chatId);

    res.json({
      success: true,
      progress: progress
    });
  } catch (error) {
    console.error("Get progress failed:", error.message);

    res.status(500).json({
      success: false,
      error: "Could not load progress"
    });
  }
});

app.post("/api/help", async (req, res) => {
  try {
    const chatId = req.body.chatId;
    const question = req.body.question;

    if (!chatId || !question) {
      return res.status(400).json({
        success: false,
        error: "chatId and question are required"
      });
    }

    await db.saveHelpRequest(chatId, question);

    res.json({
      success: true,
      message: "Help request saved"
    });
  } catch (error) {
    console.error("Save help request failed:", error.message);

    res.status(500).json({
      success: false,
      error: "Could not save help request"
    });
  }
});

app.post("/api/accommodation", async (req, res) => {
  try {
    const chatId = req.body.chatId;
    const accommodation = req.body.accommodation;

    if (!chatId || !accommodation) {
      return res.status(400).json({
        success: false,
        error: "chatId and accommodation are required"
      });
    }

    await db.saveAccommodationRequest(chatId, accommodation);

    res.json({
      success: true,
      message: "Accommodation request saved"
    });
  } catch (error) {
    console.error("Save accommodation failed:", error.message);

    res.status(500).json({
      success: false,
      error: "Could not save accommodation request"
    });
  }
});

app.post("/api/screen-share", async (req, res) => {
  try {
    const chatId = req.body.chatId;
    const meetingLink = req.body.meetingLink;

    if (!chatId || !meetingLink) {
      return res.status(400).json({
        success: false,
        error: "chatId and meetingLink are required"
      });
    }

    await db.saveScreenShareRequest(chatId, meetingLink);

    res.json({
      success: true,
      message: "Screen-sharing request saved"
    });
  } catch (error) {
    console.error("Save screen-share request failed:", error.message);

    res.status(500).json({
      success: false,
      error: "Could not save screen-sharing request"
    });
  }
});

const PORT = process.env.PORT || 8080;

async function start() {
  try {
    await db.createTables();

    app.listen(PORT, () => {
      console.log("Track 3 web API is running on port " + PORT);
    });
  } catch (error) {
    console.error("Database startup failed:", error.message);

    app.listen(PORT, () => {
      console.log("Web API started without database connection.");
    });
  }
}

start();
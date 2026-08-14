/**
 * StringSession تلگرام (بعد از اولین لاگین موفق) اینجا ذخیره می‌شود تا
 * دفعات بعد نیازی به وارد کردن دوباره‌ی کد تایید نباشد.
 */
const fs = require("fs");
const path = require("path");

const SESSION_PATH = path.join(__dirname, "..", "session.txt");

function loadSession() {
  if (!fs.existsSync(SESSION_PATH)) return "";
  return fs.readFileSync(SESSION_PATH, "utf-8").trim();
}

function saveSession(sessionString) {
  fs.writeFileSync(SESSION_PATH, sessionString || "", "utf-8");
}

module.exports = { loadSession, saveSession };

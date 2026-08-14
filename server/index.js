const path = require("path");
const express = require("express");
const { loadConfig } = require("./config");
const { TelegramService, LoginRequires2FA } = require("./telegramService");

const cfg = loadConfig();
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

const telegramService = new TelegramService(cfg);
let lastStatus = "آماده";

function setStatus(msg) {
  lastStatus = msg;
  console.log("[status]", msg);
}

// ------------------------------------------------------------------
// وضعیت کلی + شروع اتصال
// ------------------------------------------------------------------
app.get("/api/status", (req, res) => {
  res.json({ status: lastStatus, hasClient: !!telegramService.client });
});

app.post("/api/auth/connect", async (req, res) => {
  try {
    if (!cfg.apiId || !cfg.apiHash || !cfg.phone) {
      return res.status(400).json({
        error: "لطفاً ابتدا apiId، apiHash و phone را در فایل config.json پر کنید.",
      });
    }
    await telegramService.connect(setStatus);
    const authorized = await telegramService.isUserAuthorized();
    res.json({ ok: true, authorized, status: lastStatus });
  } catch (e) {
    setStatus(`خطا در اتصال: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

function ensureConnected(res) {
  if (!telegramService.client) {
    res.status(400).json({
      error: "هنوز به تلگرام متصل نشده‌اید. ابتدا دکمه‌ی «اتصال» را بزنید.",
      needsConnect: true,
    });
    return false;
  }
  return true;
}

app.post("/api/auth/send-code", async (req, res) => {
  if (!ensureConnected(res)) return;
  try {
    await telegramService.sendCode();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/auth/sign-in", async (req, res) => {
  if (!ensureConnected(res)) return;
  const { code } = req.body;
  try {
    await telegramService.signIn(code);
    res.json({ ok: true, authorized: true });
  } catch (e) {
    if (e instanceof LoginRequires2FA) {
      return res.json({ ok: true, needsPassword: true });
    }
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/auth/check-password", async (req, res) => {
  if (!ensureConnected(res)) return;
  const { password } = req.body;
  try {
    await telegramService.checkPassword(password);
    res.json({ ok: true, authorized: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ------------------------------------------------------------------
// فایل‌ها: صفحه‌بندی، پیش‌نمایش، دانلود، حذف
// ------------------------------------------------------------------
app.get("/api/files", async (req, res) => {
  if (!ensureConnected(res)) return;
  const offsetId = parseInt(req.query.offsetId || "0", 10);
  const limit = parseInt(req.query.limit || String(cfg.pageSize), 10);
  try {
    const items = await telegramService.getFilesPage(offsetId, limit);
    res.json({ items });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/files/:id/thumb", async (req, res) => {
  if (!ensureConnected(res)) return;
  try {
    const buf = await telegramService.getThumbBuffer(parseInt(req.params.id, 10));
    if (!buf) return res.status(404).end();
    res.set("Cache-Control", "public, max-age=86400");
    res.set("Content-Type", "image/jpeg");
    res.send(buf);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/files/:id/preview", async (req, res) => {
  if (!ensureConnected(res)) return;
  try {
    const buf = await telegramService.getFileBuffer(parseInt(req.params.id, 10));
    res.set("Content-Type", req.query.mime || "application/octet-stream");
    res.set("Content-Length", buf.length);
    res.send(buf);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/files/:id/download", async (req, res) => {
  if (!ensureConnected(res)) return;
  try {
    const buf = await telegramService.getFileBuffer(parseInt(req.params.id, 10));
    const filename = req.query.filename || `file_${req.params.id}`;
    res.set("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    res.set("Content-Type", "application/octet-stream");
    res.set("Content-Length", buf.length);
    res.send(buf);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/files/:id", async (req, res) => {
  if (!ensureConnected(res)) return;
  try {
    await telegramService.deleteMessages([parseInt(req.params.id, 10)]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = cfg.port || 4173;
app.listen(PORT, "127.0.0.1", () => {
  console.log(`سرور روی http://127.0.0.1:${PORT} اجرا شد`);
  console.log(`برای دسترسی از موبایل/تبلت در همان شبکه‌ی وای‌فای، از آی‌پی این کامپیوتر به‌جای 127.0.0.1 استفاده کنید.`);
});

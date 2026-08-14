/**
 * Telegram Client Wrapper (لایه‌ی مستقل ارتباط با MTProto از طریق GramJS)
 * ---------------------------------------------------------------------
 * تمام کدهای بقیه‌ی سرور فقط با متدهای این کلاس کار می‌کنند، نه مستقیم
 * با GramJS. یعنی اگر روزی خواستیم کتابخانه‌ی زیرین را عوض کنیم، فقط
 * همین فایل تغییر می‌کند (اصل معماری ماژولار).
 */
const { TelegramClient, Api } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { computeCheck } = require("telegram/Password");
const { loadSession, saveSession } = require("./sessionStore");

class LoginRequires2FA extends Error {
  constructor() {
    super("این حساب رمز دو مرحله‌ای (Cloud Password) دارد.");
    this.name = "LoginRequires2FA";
  }
}

function withTimeout(promise, ms, timeoutMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(timeoutMessage || "timeout")), ms)
    ),
  ]);
}

class TelegramService {
  constructor(cfg) {
    this.cfg = cfg;
    this.client = null;
    this._phoneCodeHash = null;
  }

  _buildProxyOption() {
    const p = this.cfg.proxy;
    return {
      ip: p.ip,
      port: p.port,
      socksType: p.socksType || 5,
      timeout: p.timeout || 8,
    };
  }

  async _tryConnect(useProxy, timeoutSec) {
    const session = new StringSession(loadSession());
    const client = new TelegramClient(session, this.cfg.apiId, this.cfg.apiHash, {
      connectionRetries: 1,
      proxy: useProxy ? this._buildProxyOption() : undefined,
      timeout: timeoutSec,
    });
    await withTimeout(client.connect(), timeoutSec * 1000, "اتصال timeout شد");
    return client;
  }

  /**
   * بر اساس proxyMode در تنظیمات وصل می‌شود.
   * onStatus(msg) برای گزارش وضعیت به فرانت‌اند (از طریق WebSocket) استفاده می‌شود.
   */
  async connect(onStatus = () => {}) {
    const mode = this.cfg.proxyMode || "auto";
    const timeoutSec = this.cfg.directConnectTimeoutSec || 8;

    if (mode === "direct") {
      onStatus("در حال اتصال مستقیم (بدون پروکسی)...");
      this.client = await this._tryConnect(false, timeoutSec);
      return;
    }
    if (mode === "proxy") {
      onStatus("در حال اتصال از طریق پروکسی SOCKS5...");
      this.client = await this._tryConnect(true, timeoutSec);
      return;
    }
    // auto
    try {
      onStatus("در حال تلاش برای اتصال مستقیم...");
      this.client = await this._tryConnect(false, timeoutSec);
      onStatus("اتصال مستقیم برقرار شد.");
    } catch (e) {
      onStatus("اتصال مستقیم ناموفق بود، تلاش با پروکسی SOCKS5...");
      this.client = await this._tryConnect(true, timeoutSec);
      onStatus("اتصال از طریق پروکسی برقرار شد.");
    }
  }

  async isUserAuthorized() {
    return await this.client.isUserAuthorized();
  }

  async sendCode() {
    const result = await this.client.sendCode(
      { apiId: this.cfg.apiId, apiHash: this.cfg.apiHash },
      this.cfg.phone
    );
    this._phoneCodeHash = result.phoneCodeHash;
  }

  async signIn(code) {
    try {
      await this.client.invoke(
        new Api.auth.SignIn({
          phoneNumber: this.cfg.phone,
          phoneCodeHash: this._phoneCodeHash,
          phoneCode: code,
        })
      );
    } catch (e) {
      if (e.errorMessage === "SESSION_PASSWORD_NEEDED") {
        throw new LoginRequires2FA();
      }
      throw e;
    }
    saveSession(this.client.session.save());
  }

  async checkPassword(password) {
    const passwordInfo = await this.client.invoke(new Api.account.GetPassword());
    const srpCheck = await computeCheck(passwordInfo, password);
    await this.client.invoke(new Api.auth.CheckPassword({ password: srpCheck }));
    saveSession(this.client.session.save());
  }

  // ------------------------------------------------------------------
  // خواندن فایل‌های Saved Messages (صفحه‌بندی‌شده)
  // ------------------------------------------------------------------
  async getFilesPage(offsetId = 0, limit = 50) {
    // نکته: فیلتر InputMessagesFilterDocument طبق مستندات تلگرام فقط
    // "فایل عمومی" را برمی‌گرداند و ویدیو/صدا/عکس را حذف می‌کند -- به
    // همین دلیل فیلترش نمی‌کنیم و خودمان تشخیص می‌دهیم.
    const messages = await this.client.getMessages("me", { limit, offsetId });

    const items = [];
    for (const msg of messages) {
      if (!msg.media) continue; // پیام‌های فقط-متنی را رد کن
      if (msg.media.className === "MessageMediaWebPage") continue; // پیش‌نمایش لینک نیست

      let filename = null;
      let size = 0;
      let mimeType = "";
      let hasThumb = false;
      let isImage = false;
      let isVideo = false;

      if (msg.document) {
        const filenameAttr = (msg.document.attributes || []).find(
          (a) => a.className === "DocumentAttributeFilename"
        );
        mimeType = msg.document.mimeType || "";
        size = Number(msg.document.size || 0);
        hasThumb = (msg.document.thumbs || []).length > 0;
        isVideo =
          mimeType.startsWith("video/") ||
          (msg.document.attributes || []).some((a) => a.className === "DocumentAttributeVideo");
        isImage = mimeType.startsWith("image/");
        filename = filenameAttr ? filenameAttr.fileName : null;
        if (!filename) {
          const ext = (mimeType.split("/")[1] || "bin").split(";")[0];
          filename = `${isVideo ? "video" : isImage ? "image" : "file"}_${msg.id}.${ext}`;
        }
      } else if (msg.photo) {
        isImage = true;
        hasThumb = true;
        mimeType = "image/jpeg";
        filename = `photo_${msg.id}.jpg`;
        const sizes = msg.photo.sizes || [];
        const largest = sizes[sizes.length - 1];
        size = largest && largest.size ? Number(largest.size) : 0;
      } else {
        continue; // نوع رسانه‌ی دیگر (نظرسنجی، مخاطب و ...) -- فعلاً نمایش داده نمی‌شود
      }

      items.push({
        messageId: msg.id,
        date: msg.date ? msg.date.toISOString?.() ?? String(msg.date) : null,
        filename,
        size,
        mimeType,
        isImage,
        isVideo,
        hasThumb,
      });
    }
    return items;
  }

  // ------------------------------------------------------------------
  // پیش‌نمایش (thumbnail کوچک) و دانلود کامل
  // ------------------------------------------------------------------
  async getThumbBuffer(messageId) {
    const messages = await this.client.getMessages("me", { ids: [messageId] });
    const message = messages && messages[0];
    if (!message || !message.media) return null;
    try {
      const buf = await this.client.downloadMedia(message, { thumb: -1 });
      return buf && buf.length > 0 ? buf : null;
    } catch (e) {
      return null;
    }
  }

  async getFileBuffer(messageId) {
    const messages = await this.client.getMessages("me", { ids: [messageId] });
    const message = messages && messages[0];
    if (!message || !message.media) {
      throw new Error(
        `پیام یا فایل با آیدی ${messageId} پیدا نشد (شاید در تلگرام حذف شده باشد؛ صفحه را رفرش کنید)`
      );
    }
    const buf = await this.client.downloadMedia(message, {});
    if (!buf || buf.length === 0) {
      throw new Error(
        "دانلود ناموفق بود: پاسخ خالی از تلگرام دریافت شد. معمولاً به‌خاطر منقضی‌شدن reference فایل است -- صفحه را رفرش کنید و دوباره امتحان کنید."
      );
    }
    return buf;
  }

  async deleteMessages(messageIds) {
    await this.client.deleteMessages("me", messageIds, { revoke: true });
  }

  async disconnect() {
    if (this.client) await this.client.disconnect();
  }
}

module.exports = { TelegramService, LoginRequires2FA };

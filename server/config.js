/**
 * مدیریت تنظیمات برنامه.
 * تنظیمات در فایل config.json (کنار پوشه server) نگه‌داری می‌شود.
 * اگر فایل نبود، یک نسخه‌ی پیش‌فرض ساخته می‌شود که باید تکمیل کنید.
 */
const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.join(__dirname, "..", "config.json");

const DEFAULT_CONFIG = {
  // این مقادیر را از https://my.telegram.org -> API Development Tools بگیرید
  apiId: 0,
  apiHash: "",

  // شماره تلفن با کد کشور، مثال: "+989123456789"
  phone: "",

  // تعداد فایل در هر صفحه
  pageSize: 50,

  // پورت وب‌سرور محلی (در مرورگر: http://127.0.0.1:PORT)
  port: 4173,

  // --------------------------------------------------------------
  // تنظیمات پروکسی -- proxyMode یکی از سه مقدار زیر:
  //   "auto"   : ابتدا اتصال مستقیم امتحان می‌شود (با یک timeout کوتاه)،
  //              اگر ناموفق بود خودکار به پروکسی SOCKS5 سوییچ می‌کند.
  //              اگر Proxifier را روی گرفتن ترافیک node.exe تنظیم کرده‌اید
  //              همین حالت auto هم کار می‌کند چون در عمل اتصال "مستقیم"
  //              از دید برنامه، توسط Proxifier به‌صورت شفاف تانل می‌شود.
  //   "direct" : همیشه بدون پروکسی (وقتی Proxifier کل ترافیک را می‌گیرد
  //              یا به فیلترشکن نیاز ندارید)
  //   "proxy"  : همیشه مستقیماً به پورت SOCKS5 محلی v2ray وصل شو
  //              (بدون واسطه‌ی Proxifier)
  // --------------------------------------------------------------
  proxyMode: "auto",
  proxy: {
    ip: "127.0.0.1",
    port: 10808,       // پورت پیش‌فرض معمول SOCKS5 در v2ray -- در تنظیمات v2ray خودتان چک کنید
    socksType: 5,       // 5 برای SOCKS5
    timeout: 8
  },

  // مهلت اتصال مستقیم قبل از سوییچ به پروکسی در حالت auto (ثانیه)
  directConnectTimeoutSec: 8
};

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    saveConfig(DEFAULT_CONFIG);
    return { ...DEFAULT_CONFIG };
  }
  const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  // هر کلید جدید که در نسخه‌های بعدی اضافه شود از دیفالت پر می‌شود
  const merged = { ...DEFAULT_CONFIG, ...raw };
  merged.proxy = { ...DEFAULT_CONFIG.proxy, ...(raw.proxy || {}) };
  return merged;
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf-8");
}

module.exports = { loadConfig, saveConfig, CONFIG_PATH, DEFAULT_CONFIG };

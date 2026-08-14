// ------------------------------------------------------------------
// وضعیت صفحه‌بندی (مشابه منطق نسخه دسکتاپ): تاریخچه‌ی offsetId هر صفحه
// را نگه می‌داریم تا دکمه‌ی "قبلی" بدون درخواست مجدد کار کند و صفحات
// دیده‌شده در حافظه‌ی مرورگر کش شوند.
// ------------------------------------------------------------------
let PAGE_SIZE = 50;

const pagination = {
  history: [0],       // offsetId لازم برای هر صفحه
  currentPage: 0,
  lastIdOfPage: {},   // page -> آخرین messageId (برای محاسبه‌ی صفحه بعد)
  pageCache: {},       // page -> items[]

  offsetForCurrent() { return this.history[this.currentPage]; },
  hasNext() { return this.lastIdOfPage[this.currentPage] !== undefined; },
  hasPrev() { return this.currentPage > 0; },

  recordResult(page, items) {
    this.pageCache[page] = items;
    if (items.length > 0) this.lastIdOfPage[page] = items[items.length - 1].messageId;
  },

  goNext() {
    const lastId = this.lastIdOfPage[this.currentPage];
    if (lastId === undefined) return null;
    const nextPage = this.currentPage + 1;
    if (nextPage >= this.history.length) this.history.push(lastId);
    this.currentPage = nextPage;
    return this.offsetForCurrent();
  },
  goPrev() {
    if (this.currentPage === 0) return null;
    this.currentPage -= 1;
    return this.offsetForCurrent();
  },
};

// ------------------------------------------------------------------
// المان‌ها
// ------------------------------------------------------------------
const el = (id) => document.getElementById(id);
const statusText = el("status-text");
const loginSection = el("login-section");
const filesSection = el("files-section");
const fileGrid = el("file-grid");
const btnPrev = el("btn-prev");
const btnNext = el("btn-next");
const pageIndicator = el("page-indicator");
const contextMenu = el("context-menu");
const modalOverlay = el("preview-modal");
const modalBody = el("modal-body");
const modalFilename = el("modal-filename");
const toastEl = el("toast");

let activeItem = null; // آیتمی که در حال حاضر منوی راست‌کلیک/مودال برای آن باز است

function showToast(msg, isError = false) {
  toastEl.textContent = msg;
  toastEl.style.background = isError ? "var(--danger)" : "var(--text)";
  toastEl.style.color = isError ? "#fff" : "var(--bg)";
  toastEl.classList.remove("hidden");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toastEl.classList.add("hidden"), 3200);
}

// ------------------------------------------------------------------
// جریان ورود
// ------------------------------------------------------------------
async function bootstrap() {
  try {
    statusText.textContent = "در حال اتصال به تلگرام...";
    const result = await Api.connect();
    if (result.authorized) {
      statusText.textContent = "متصل";
      showFilesUI();
      loadPage(0, 0);
    } else {
      statusText.textContent = "نیاز به ورود";
      loginSection.classList.remove("hidden");
      el("connect-step").classList.remove("hidden");
    }
  } catch (e) {
    statusText.textContent = "خطا در اتصال";
    loginSection.classList.remove("hidden");
    showLoginError(e.message);
  }
}

function showLoginError(msg) {
  const errEl = el("login-error");
  errEl.textContent = msg;
  errEl.classList.remove("hidden");
}

function showFilesUI() {
  loginSection.classList.add("hidden");
  filesSection.classList.remove("hidden");
}

el("btn-connect").addEventListener("click", async () => {
  el("login-error").classList.add("hidden");
  el("btn-connect").disabled = true;
  el("btn-connect").textContent = "در حال اتصال...";
  try {
    // ابتدا مطمئن می‌شویم واقعاً به تلگرام وصل هستیم (ممکن است تلاش قبلی
    // به‌خاطر مشکل شبکه/پروکسی ناموفق مانده باشد)
    const connectResult = await Api.connect();
    if (!connectResult.authorized) {
      await Api.sendCode();
      el("connect-step").classList.add("hidden");
      el("code-step").classList.remove("hidden");
    } else {
      statusText.textContent = "متصل";
      showFilesUI();
      loadPage(0, 0);
    }
  } catch (e) {
    showLoginError(e.message);
  } finally {
    el("btn-connect").disabled = false;
    el("btn-connect").textContent = "اتصال و ارسال کد تایید";
  }
});

el("btn-submit-code").addEventListener("click", async () => {
  const code = el("code-input").value.trim();
  if (!code) return;
  try {
    const result = await Api.signIn(code);
    if (result.needsPassword) {
      el("code-step").classList.add("hidden");
      el("password-step").classList.remove("hidden");
      return;
    }
    statusText.textContent = "متصل";
    showFilesUI();
    loadPage(0, 0);
  } catch (e) {
    showLoginError(e.message);
  }
});

el("btn-submit-password").addEventListener("click", async () => {
  const password = el("password-input").value;
  if (!password) return;
  try {
    await Api.checkPassword(password);
    statusText.textContent = "متصل";
    showFilesUI();
    loadPage(0, 0);
  } catch (e) {
    showLoginError(e.message);
  }
});

// ------------------------------------------------------------------
// بارگذاری صفحه‌ی فایل‌ها
// ------------------------------------------------------------------
async function loadPage(page, offsetId) {
  if (pagination.pageCache[page]) {
    renderGrid(pagination.pageCache[page]);
    updatePager();
    return;
  }
  statusText.textContent = "در حال دریافت فایل‌ها...";
  try {
    const { items } = await Api.getFiles(offsetId, PAGE_SIZE);
    pagination.recordResult(page, items);
    renderGrid(items);
    statusText.textContent = `${items.length} فایل`;
    updatePager();
  } catch (e) {
    statusText.textContent = "خطا در دریافت فایل‌ها";
    showToast(e.message, true);
  }
}

function updatePager() {
  btnPrev.disabled = !pagination.hasPrev();
  btnNext.disabled = !pagination.hasNext();
  pageIndicator.textContent = `صفحه ${pagination.currentPage + 1}`;
}

btnNext.addEventListener("click", () => {
  const offset = pagination.goNext();
  if (offset !== null) loadPage(pagination.currentPage, offset);
});
btnPrev.addEventListener("click", () => {
  const offset = pagination.goPrev();
  if (offset !== null) loadPage(pagination.currentPage, offset);
});

el("page-size-select").addEventListener("change", (e) => {
  PAGE_SIZE = parseInt(e.target.value, 10);
  // چون مرز صفحات با تغییر تعداد آیتم در هر صفحه عوض می‌شود، کش و
  // تاریخچه‌ی صفحه‌بندی باید کاملاً ریست شود
  pagination.history = [0];
  pagination.currentPage = 0;
  pagination.lastIdOfPage = {};
  pagination.pageCache = {};
  loadPage(0, 0);
});

// ------------------------------------------------------------------
// رندر گرید فایل‌ها
// ------------------------------------------------------------------
const EXT_COLORS = {
  pdf: "#D85A30", doc: "#378ADD", docx: "#378ADD",
  xls: "#639922", xlsx: "#639922", ppt: "#EF9F27", pptx: "#EF9F27",
  zip: "#888780", rar: "#888780", "7z": "#888780",
  mp4: "#D4537E", mov: "#D4537E", avi: "#D4537E",
  mp3: "#7F77DD", wav: "#7F77DD",
};
const DEFAULT_COLOR = "#5F5E5A";

function humanSize(bytes) {
  if (!bytes) return "؟";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0, val = bytes;
  while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
  return `${val.toFixed(1)} ${units[i]}`;
}

function extOf(filename) {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
}

function renderGrid(items) {
  fileGrid.innerHTML = "";
  for (const item of items) {
    const card = document.createElement("div");
    card.className = "file-card";
    card.dataset.id = item.messageId;

    const thumb = document.createElement("div");
    thumb.className = "file-thumb";
    const ext = extOf(item.filename);

    if (item.isImage && item.hasThumb) {
      const img = document.createElement("img");
      img.loading = "lazy";
      img.src = Api.thumbUrl(item.messageId);
      thumb.appendChild(img);
    } else {
      thumb.style.background = EXT_COLORS[ext] || DEFAULT_COLOR;
      thumb.textContent = (ext || "FILE").toUpperCase().slice(0, 4);
    }

    const name = document.createElement("div");
    name.className = "file-name";
    name.title = item.filename;
    name.textContent = item.filename;

    const size = document.createElement("div");
    size.className = "file-size";
    size.textContent = humanSize(item.size);

    card.appendChild(thumb);
    card.appendChild(name);
    card.appendChild(size);
    fileGrid.appendChild(card);

    // کلیک ساده -> پیش‌نمایش
    card.addEventListener("click", () => openPreview(item));

    // راست‌کلیک -> منو
    card.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      openContextMenu(e.clientX, e.clientY, item);
    });

    // لمس طولانی برای موبایل/تبلت -> منو
    let pressTimer = null;
    card.addEventListener("touchstart", (e) => {
      const touch = e.touches[0];
      pressTimer = setTimeout(() => {
        openContextMenu(touch.clientX, touch.clientY, item);
      }, 500);
    });
    card.addEventListener("touchend", () => clearTimeout(pressTimer));
    card.addEventListener("touchmove", () => clearTimeout(pressTimer));
  }
}

// ------------------------------------------------------------------
// منوی راست‌کلیک / لمس طولانی
// ------------------------------------------------------------------
function openContextMenu(x, y, item) {
  activeItem = item;
  contextMenu.style.left = `${Math.min(x, window.innerWidth - 180)}px`;
  contextMenu.style.top = `${Math.min(y, window.innerHeight - 160)}px`;
  contextMenu.classList.remove("hidden");
}

function closeContextMenu() {
  contextMenu.classList.add("hidden");
}

document.addEventListener("click", (e) => {
  if (!contextMenu.contains(e.target)) closeContextMenu();
});

contextMenu.addEventListener("click", (e) => {
  const action = e.target.dataset.action;
  if (!action || !activeItem) return;
  closeContextMenu();
  if (action === "preview") openPreview(activeItem);
  if (action === "download") downloadItem(activeItem);
  if (action === "delete") deleteItem(activeItem);
});

// ------------------------------------------------------------------
// مودال پیش‌نمایش
// ------------------------------------------------------------------
function openPreview(item) {
  activeItem = item;
  modalFilename.textContent = `${item.filename} — ${humanSize(item.size)}`;
  modalBody.innerHTML = "";

  if (item.isImage) {
    const img = document.createElement("img");
    img.src = Api.previewUrl(item.messageId, item.mimeType);
    modalBody.appendChild(img);
  } else if (item.isVideo) {
    const video = document.createElement("video");
    video.src = Api.previewUrl(item.messageId, item.mimeType);
    video.controls = true;
    modalBody.appendChild(video);
  } else if (item.mimeType === "application/pdf") {
    const iframe = document.createElement("iframe");
    iframe.src = Api.previewUrl(item.messageId, item.mimeType);
    modalBody.appendChild(iframe);
  } else {
    const div = document.createElement("div");
    div.className = "generic-preview";
    const ext = extOf(item.filename).toUpperCase() || "FILE";
    div.innerHTML = `<div style="font-size:2.2rem;font-weight:700;margin-bottom:8px;">${ext}</div>پیش‌نمایش مستقیم برای این نوع فایل پشتیبانی نمی‌شود.<br/>می‌توانید آن را دانلود کنید.`;
    modalBody.appendChild(div);
  }

  modalOverlay.classList.remove("hidden");
}

el("modal-close").addEventListener("click", () => modalOverlay.classList.add("hidden"));
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) modalOverlay.classList.add("hidden");
});
el("modal-download").addEventListener("click", () => activeItem && downloadItem(activeItem));
el("modal-delete").addEventListener("click", () => activeItem && deleteItem(activeItem));

// ------------------------------------------------------------------
// دانلود / حذف
// ------------------------------------------------------------------
function downloadItem(item) {
  const a = document.createElement("a");
  a.href = Api.downloadUrl(item.messageId, item.filename);
  a.download = item.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  showToast(`دانلود «${item.filename}» شروع شد`);
}

async function deleteItem(item) {
  if (!confirm(`آیا از حذف «${item.filename}» از Saved Messages مطمئن هستید؟`)) return;
  try {
    await Api.deleteFile(item.messageId);
    modalOverlay.classList.add("hidden");
    const card = fileGrid.querySelector(`[data-id="${item.messageId}"]`);
    if (card) card.remove();
    // از کش صفحه فعلی هم حذف شود
    const cached = pagination.pageCache[pagination.currentPage];
    if (cached) pagination.pageCache[pagination.currentPage] = cached.filter(i => i.messageId !== item.messageId);
    showToast(`«${item.filename}» حذف شد`);
  } catch (e) {
    showToast(e.message, true);
  }
}

// ------------------------------------------------------------------
bootstrap();

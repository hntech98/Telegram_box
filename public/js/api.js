const Api = {
  async _json(url, options) {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `خطای سرور (${res.status})`);
    return data;
  },

  getStatus() {
    return this._json("/api/status");
  },
  connect() {
    return this._json("/api/auth/connect", { method: "POST" });
  },
  sendCode() {
    return this._json("/api/auth/send-code", { method: "POST" });
  },
  signIn(code) {
    return this._json("/api/auth/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
  },
  checkPassword(password) {
    return this._json("/api/auth/check-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
  },
  getFiles(offsetId, limit) {
    return this._json(`/api/files?offsetId=${offsetId}&limit=${limit}`);
  },
  thumbUrl(id) {
    return `/api/files/${id}/thumb`;
  },
  previewUrl(id, mime) {
    return `/api/files/${id}/preview?mime=${encodeURIComponent(mime || "")}`;
  },
  downloadUrl(id, filename) {
    return `/api/files/${id}/download?filename=${encodeURIComponent(filename || "")}`;
  },
  async deleteFile(id) {
    return this._json(`/api/files/${id}`, { method: "DELETE" });
  },
};

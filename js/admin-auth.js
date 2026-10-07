(() => {
  // Strengthened client-side gate — not server auth. Hash only; no plaintext password shipped.
  const AUTH = {
    algo: "PBKDF2",
    hash: "SHA-256",
    iterations: 210000,
    saltB64: "on/nWOBfj6IralOWjb1IiQ==",
    // PBKDF2-HMAC-SHA256 of the Admin unlock password
    hashB64: "R6z13y9Nf6GWmYHu6AzuTPLlrxG/mnx/O5y6kK/KaoQ=",
  };

  const RL_KEY = "sapna_admin_rl_v1";
  const MAX_FAILS = 5;
  const LOCK_MS = 60 * 1000;

  function b64ToBuf(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function timingSafeEqual(a, b) {
    if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array) || a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
  }

  function readRateLimit() {
    try {
      return JSON.parse(sessionStorage.getItem(RL_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }

  function writeRateLimit(state) {
    try {
      sessionStorage.setItem(RL_KEY, JSON.stringify(state));
    } catch {
      /* ignore quota */
    }
  }

  function getLockStatus() {
    const state = readRateLimit();
    const now = Date.now();
    if (state.lockedUntil && now < state.lockedUntil) {
      const secs = Math.ceil((state.lockedUntil - now) / 1000);
      return { locked: true, secs, fails: state.fails || 0 };
    }
    if (state.lockedUntil && now >= state.lockedUntil) {
      writeRateLimit({ fails: 0 });
      return { locked: false, secs: 0, fails: 0 };
    }
    return { locked: false, secs: 0, fails: state.fails || 0 };
  }

  function recordFailure() {
    const state = readRateLimit();
    const fails = (state.fails || 0) + 1;
    const next = { fails };
    if (fails >= MAX_FAILS) {
      next.lockedUntil = Date.now() + LOCK_MS;
      next.fails = 0;
    }
    writeRateLimit(next);
    return getLockStatus();
  }

  function clearFailures() {
    try {
      sessionStorage.removeItem(RL_KEY);
    } catch {
      /* ignore */
    }
  }

  async function derive(password) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: b64ToBuf(AUTH.saltB64),
        iterations: AUTH.iterations,
        hash: AUTH.hash,
      },
      keyMaterial,
      256
    );
    return new Uint8Array(bits);
  }

  async function verifyPassword(password) {
    const lock = getLockStatus();
    if (lock.locked) {
      return {
        ok: false,
        reason: "locked",
        message: `Too many attempts. Try again in ${lock.secs}s.`,
      };
    }
    if (!password || !window.crypto?.subtle) {
      return { ok: false, reason: "unsupported", message: "Secure unlock unavailable in this browser." };
    }
    try {
      const derived = await derive(password);
      const expected = b64ToBuf(AUTH.hashB64);
      if (timingSafeEqual(derived, expected)) {
        clearFailures();
        return { ok: true };
      }
      const after = recordFailure();
      if (after.locked) {
        return {
          ok: false,
          reason: "locked",
          message: `Wrong password. Locked for ${after.secs}s after too many tries.`,
        };
      }
      const left = Math.max(0, MAX_FAILS - after.fails);
      return {
        ok: false,
        reason: "mismatch",
        message: `Wrong password. ${left} attempt${left === 1 ? "" : "s"} left before a short lockout.`,
      };
    } catch (err) {
      console.error("Admin verify failed", err);
      return { ok: false, reason: "error", message: "Could not verify password. Try again." };
    }
  }

  window.__sapnaAdminAuth = {
    verifyPassword,
    getLockStatus,
    clearFailures,
  };
})();

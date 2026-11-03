const PASSWORD_ITERATIONS = 210000;
const LOCKOUT_MS = 15 * 60 * 1000;
const RATE_WINDOW_MS = 60 * 1000;
const MAX_ATTEMPTS_PER_WINDOW = 20;
const MAX_FAILED_ATTEMPTS = 5;

const INITIAL_ACCOUNTS = {
  U1: { loginId: 'PHARM001', salt: 'c08b4c441e6a1237d3e44354c0978ade', hash: '6a80fbf7a240b3ea114585b0a2a3169576bbea184bd4f79213f7205f64d73661' },
  U2: { loginId: 'PHARM002', salt: '5b73bbbe9d877769fc24916300b575cc', hash: 'ac4fc3ecfa52a47aae8c259866dc964c73cbd5c6f44881aaf94e184750433b88' },
  U3: { loginId: 'PHARM003', salt: 'e7af08f9cc4f0c5213649445fef1189e', hash: '5da8283beb63ad415f7d986045d890bb09a06977639426dcb8da8caa18df6bef' },
  U4: { loginId: 'PHARM004', salt: '76c6f4f2aee546dcffc1ef0afa11b92e', hash: '4df44072cf26a3fa92384e50529cd9710701ae5863fd536927545d82891ca9bd' },
  U5: { loginId: 'PHARM005', salt: '6af200da0b37950a20982a7cfbd01962', hash: 'b885ad875184db16ac0aa67aabee19a7453dc9558a1dc22be764a01fcac88d86' },
  U6: { loginId: 'MO001', salt: '98cdea095c1fa72c98ae8e87e45cc2a3', hash: '6f158addfce029e689539bae4bb03a8f9405cd19858ff45981e2eae7e2e617d1' },
  U7: { loginId: 'ADMIN001', salt: '41f996c66223e5ad2ff55ed9160f49f6', hash: '0eea4c635291f1f6a703550fc1b0c2397f582e78e158eba8ccc0da49f793e559' },
};

const toHex = (bytes) => [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, '0')).join('');
const fromHex = (value) => Uint8Array.from(value.match(/.{2}/g) || [], (byte) => Number.parseInt(byte, 16));

export async function hashDemoPassword(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2', salt: fromHex(salt), iterations: PASSWORD_ITERATIONS, hash: 'SHA-256',
  }, key, 256);
  return toHex(bits);
}

export function attachDefaultCredentials(users) {
  const used = new Set();
  return (users || []).map((user) => {
    const preset = INITIAL_ACCOUNTS[user.id];
    let auth = user.auth ? { ...user.auth } : null;
    if (!auth && preset && !used.has(preset.loginId.toUpperCase())) {
      auth = { ...preset, failedAttempts: 0, lockedUntil: 0, active: true };
    } else if (auth?.loginId) {
      auth = { ...auth, failedAttempts: Number(auth.failedAttempts) || 0, lockedUntil: Number(auth.lockedUntil) || 0, active: auth.active !== false };
    } else {
      auth = { failedAttempts: 0, lockedUntil: 0, active: true };
    }
    if (!auth.loginId || used.has(auth.loginId.toUpperCase())) auth.loginId = nextLoginId([...users.filter((item) => item.id !== user.id), ...usedLoginUsers(used)], user.role);
    used.add(auth.loginId.toUpperCase());
    return { ...user, auth };
  });
}

function usedLoginUsers(used) {
  return [...used].map((loginId) => ({ auth: { loginId } }));
}

function rolePrefix(role) {
  if (role === 'Pharmacist') return 'PHARM';
  if (role === 'Medical Officer') return 'MO';
  return 'ADMIN';
}

function nextLoginId(users, role) {
  const prefix = rolePrefix(role);
  const used = new Set((users || []).map((user) => user.auth?.loginId?.toUpperCase()).filter(Boolean));
  let number = 1;
  while (used.has(`${prefix}${String(number).padStart(3, '0')}`)) number++;
  return `${prefix}${String(number).padStart(3, '0')}`;
}

function randomHex(bytes) {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)));
}

function randomPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export async function issueDemoPassword(state, userId, actor) {
  if (actor?.role !== 'Administrator') return { error: 'Only administrators can reset demo account passwords.' };
  const user = (state.users || []).find((item) => item.id === userId);
  if (!user) return { error: 'User not found.' };
  const s = structuredClone(state);
  const account = s.users.find((item) => item.id === userId);
  const password = randomPassword();
  const salt = randomHex(16);
  const hash = await hashDemoPassword(password, salt);
  account.auth = {
    ...(account.auth || {}),
    loginId: account.auth?.loginId || nextLoginId(s.users, account.role),
    salt, hash, failedAttempts: 0, lockedUntil: 0, active: account.auth?.active !== false,
  };
  return { state: s, credential: { name: account.name, loginId: account.auth.loginId, password } };
}

export function setDemoAccountActive(state, userId, active, actor) {
  if (actor?.role !== 'Administrator') return { error: 'Only administrators can manage demo accounts.' };
  const user = (state.users || []).find((item) => item.id === userId);
  if (!user) return { error: 'User not found.' };
  if (!user.auth?.loginId) return { error: 'This account needs a password reset before it can be activated.' };
  if (!active && userId === actor.id) return { error: 'You cannot deactivate your own account.' };
  const s = structuredClone(state);
  const account = s.users.find((item) => item.id === userId);
  account.auth.active = Boolean(active);
  return { state: s };
}

const invalidCredentials = 'Invalid User ID or password.';
const timingSafeEqual = (left, right) => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
};

export async function authenticateDemoUser(state, loginId, password, now = Date.now()) {
  const s = structuredClone(state);
  const since = now - RATE_WINDOW_MS;
  s.loginAttempts = (s.loginAttempts || []).filter((timestamp) => timestamp > since);
  if (s.loginAttempts.length >= MAX_ATTEMPTS_PER_WINDOW) return { state: s, error: invalidCredentials, rateLimited: true };
  s.loginAttempts.push(now);

  const normalizedId = String(loginId || '').trim().toUpperCase();
  const user = s.users.find((item) => item.auth?.loginId?.toUpperCase() === normalizedId);
  const dummy = INITIAL_ACCOUNTS.U1;
  const credential = user?.auth?.salt && user?.auth?.hash ? user.auth : dummy;
  const candidate = await hashDemoPassword(password, credential.salt);
  const matches = timingSafeEqual(candidate, credential.hash);
  if (!user || !matches || !user.auth.active || (user.auth.lockedUntil || 0) > now) {
    if (user && user.auth.active && (user.auth.lockedUntil || 0) <= now) {
      user.auth.failedAttempts = (user.auth.failedAttempts || 0) + 1;
      if (user.auth.failedAttempts >= MAX_FAILED_ATTEMPTS) user.auth.lockedUntil = now + LOCKOUT_MS;
    }
    return { state: s, error: invalidCredentials };
  }
  user.auth.failedAttempts = 0;
  user.auth.lockedUntil = 0;
  return { state: s, userId: user.id };
}

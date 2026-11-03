import assert from 'node:assert/strict';
import { seedData } from '../src/lib/seed.js';
import { migrateStateData } from '../src/lib/logic.js';
import { authenticateDemoUser, issueDemoPassword, setDemoAccountActive } from '../src/lib/auth.js';

const credentials = [
  ['U1', 'PHARM001', 'MVQ0GPxP40477PQ1'],
  ['U2', 'PHARM002', 'zN0XTRyb9Fq4IVaY'],
  ['U3', 'PHARM003', 'h_Ah5q9sUlBiMkvS'],
  ['U4', 'PHARM004', 'tBD5braPUI7FgBsJ'],
  ['U5', 'PHARM005', 'nQwSdd-sYooR8d_b'],
  ['U6', 'MO001', 'UAPIjFKUa2wyJ2hM'],
  ['U7', 'ADMIN001', 'K_eaBjwYe9-lXUoj'],
];
const admin = (state) => state.users.find((user) => user.role === 'Administrator');
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  ok  ${name}`); };

console.log('MediClock local authentication tests');

await test('all seeded users have unique role-based Login IDs and correct credentials', async () => {
  let state = seedData('2026-11-04');
  const ids = state.users.map((user) => user.auth.loginId);
  assert.equal(new Set(ids).size, state.users.length);
  for (const [userId, loginId, password] of credentials) {
    const result = await authenticateDemoUser(state, loginId, password, 1000);
    assert.equal(result.userId, userId);
    assert.equal(result.state.users.find((user) => user.id === userId).auth.failedAttempts, 0);
    state = result.state;
  }
  const serialized = JSON.stringify(state);
  for (const [, , password] of credentials) assert.ok(!serialized.includes(password));
});

await test('wrong Login IDs and passwords are rejected with one generic error', async () => {
  const state = seedData('2026-11-04');
  const wrongId = await authenticateDemoUser(state, 'NOT-AN-ACCOUNT', credentials[0][2], 1000);
  const wrongPassword = await authenticateDemoUser(state, credentials[0][1], 'incorrect-password', 1000);
  assert.equal(wrongId.error, 'Invalid User ID or password.');
  assert.equal(wrongPassword.error, 'Invalid User ID or password.');
  assert.equal(wrongPassword.state.users[0].auth.failedAttempts, 1);
});

await test('five consecutive failures lock the account for 15 minutes across migration', async () => {
  let state = seedData('2026-11-04');
  const now = 1_000_000;
  for (let attempt = 0; attempt < 5; attempt++) {
    const result = await authenticateDemoUser(state, 'PHARM001', 'wrong-password', now + attempt);
    assert.equal(result.error, 'Invalid User ID or password.');
    state = result.state;
  }
  const account = state.users.find((user) => user.id === 'U1');
  assert.equal(account.auth.failedAttempts, 5);
  assert.equal(account.auth.lockedUntil, now + 4 + 15 * 60 * 1000);
  state = migrateStateData(JSON.parse(JSON.stringify(state)));
  assert.equal(state.users.find((user) => user.id === 'U1').auth.lockedUntil, account.auth.lockedUntil);
  assert.equal((await authenticateDemoUser(state, 'PHARM001', credentials[0][2], now + 5)).error, 'Invalid User ID or password.');
  const afterExpiry = await authenticateDemoUser(state, 'PHARM001', credentials[0][2], account.auth.lockedUntil + 1);
  assert.equal(afterExpiry.userId, 'U1');
  assert.equal(afterExpiry.state.users.find((user) => user.id === 'U1').auth.failedAttempts, 0);
  assert.equal(afterExpiry.state.users.find((user) => user.id === 'U1').auth.lockedUntil, 0);
});

await test('disabled accounts cannot log in and only an administrator can manage them', async () => {
  const state = seedData('2026-11-04');
  const adminUser = admin(state);
  const disabled = setDemoAccountActive(state, 'U1', false, adminUser).state;
  assert.equal((await authenticateDemoUser(disabled, 'PHARM001', credentials[0][2], 2000)).error, 'Invalid User ID or password.');
  assert.ok(setDemoAccountActive(state, 'U1', false, state.users[0]).error);
  assert.ok(setDemoAccountActive(state, adminUser.id, false, adminUser).error);
});

await test('login attempts are rate limited and Admin password reset issues a one-time credential', async () => {
  let state = seedData('2026-11-04');
  for (let attempt = 0; attempt < 20; attempt++) {
    const result = await authenticateDemoUser(state, 'UNKNOWN', 'incorrect', 5000 + attempt);
    state = result.state;
  }
  const limited = await authenticateDemoUser(state, 'PHARM001', credentials[0][2], 5020);
  assert.equal(limited.rateLimited, true);
  const reset = await issueDemoPassword(seedData('2026-11-04'), 'U1', admin(seedData('2026-11-04')));
  assert.ok(reset.credential.password);
  assert.equal(reset.credential.loginId, 'PHARM001');
  assert.equal(JSON.stringify(reset.state).includes(reset.credential.password), false);
  const login = await authenticateDemoUser(reset.state, reset.credential.loginId, reset.credential.password, 6000);
  assert.equal(login.userId, 'U1');
});

console.log(`\n${passed} authentication tests passed`);

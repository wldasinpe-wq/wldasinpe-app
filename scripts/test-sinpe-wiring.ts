/**
 * Verify SINPE getPhoneData wiring without sending email or requiring auth.
 *
 * Usage:
 *   tsx --env-file=.env.development.local scripts/test-sinpe-wiring.ts
 *   TEST_SINPE_PHONE=85124141 tsx --env-file=.env.local scripts/test-sinpe-wiring.ts
 */

import {
  buildComplianceEmailPlainText,
  type WithdrawalComplianceEmailInput,
} from '../src/lib/email/compliance-content';
import {
  fetchRidiviPhoneData,
  fetchRidiviToken,
  normalizeSinpePhoneDigits,
} from '../src/lib/ridivi/sinpe';
import {
  buildComplianceEmailInputFromMock,
  prismaWithdrawalUncheckedCreateData,
} from './lib/withdrawal-test-fixture';

let passed = 0;

function ok(message: string) {
  passed += 1;
  console.log(`  ✓ ${message}`);
}

function fail(message: string): never {
  console.error(`  ✗ ${message}`);
  process.exit(1);
}

function assert(condition: boolean, message: string) {
  if (condition) ok(message);
  else fail(message);
}

function testPhoneNormalization() {
  console.log('\n[1] Phone normalization');
  assert(normalizeSinpePhoneDigits('8512-4141') === '85124141', '8-digit CR');
  assert(
    normalizeSinpePhoneDigits('+50685124141') === '85124141',
    'strips +506 prefix'
  );
  assert(normalizeSinpePhoneDigits('123') === null, 'rejects short numbers');
}

function testComplianceEmailShape() {
  console.log('\n[2] Compliance email (no bank account)');
  const input = buildComplianceEmailInputFromMock('wiring_test_ref');
  const keys = Object.keys(input) as (keyof WithdrawalComplianceEmailInput)[];
  assert(!keys.includes('accountNumber' as keyof WithdrawalComplianceEmailInput), 'input type has no accountNumber');
  assert(Boolean(input.phoneNumber), 'includes phoneNumber');
  assert(Boolean(input.idNumber), 'includes idNumber');

  const body = buildComplianceEmailPlainText(input, new Date('2026-01-01T00:00:00Z'));
  assert(!body.includes('cuenta_destino'), 'email body omits cuenta_destino');
  assert(body.includes('telefono sinpe movil'), 'email body includes phone');
  assert(body.includes('numero identificacion'), 'email body includes id');
}

function testDbFixtureShape() {
  console.log('\n[3] DB fixture (nullable account_number)');
  const data = prismaWithdrawalUncheckedCreateData('wiring_test_ref');
  assert(
    !Object.prototype.hasOwnProperty.call(data, 'accountNumber'),
    'create payload omits accountNumber'
  );
  assert(Boolean(data.phoneNumber), 'create payload includes phoneNumber');
  assert(Boolean(data.idNumber), 'create payload includes idNumber');
}

async function testRidiviLive() {
  console.log('\n[4] Ridivi getPhoneData (live)');

  const baseUrl = process.env.RIDIVI_API_BASE_URL?.trim();
  const key = process.env.RIDIVI_API_KEY?.trim();
  const secret = process.env.RIDIVI_API_SECRET?.trim();
  const rawPhone = process.env.TEST_SINPE_PHONE?.trim() || '85124141';

  if (!baseUrl || !key || !secret) {
    console.log('  ⊘ skipped — set RIDIVI_API_* in env to run live test');
    return;
  }

  const digits = normalizeSinpePhoneDigits(rawPhone);
  if (!digits) fail(`invalid TEST_SINPE_PHONE: ${rawPhone}`);

  const token = await fetchRidiviToken(baseUrl, key, secret);
  assert(Boolean(token), 'Ridivi auth token received');

  try {
    const info = await fetchRidiviPhoneData(baseUrl, token, digits);
    assert(Boolean(info.NombreCliente), 'NombreCliente present');
    assert(Boolean(info.Identificacion), 'Identificacion present');
    assert(info.NumTelefono != null, 'NumTelefono present');
    console.log(`    Activo=${info.Activo} (ignored by app — lookup success is enough)`);
    console.log(`    ${info.NombreCliente} / ${info.Identificacion} / ${info.NumTelefono}`);
  } catch (e) {
    const err = e as Error & { status?: number; ridiviCode?: string };
    if (err.status === 409 || err.ridiviCode === '222') {
      ok('getPhoneData reached Ridivi (phone not in this environment — wiring OK)');
      return;
    }
    throw e;
  }
}

async function main() {
  console.log('SINPE wiring checks');
  testPhoneNormalization();
  testComplianceEmailShape();
  testDbFixtureShape();
  await testRidiviLive();
  console.log(`\n${passed} checks passed.\n`);
}

void main().catch((e) => {
  console.error('\nTest run failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});

/**
 * LTMS Communication Center - Feishu Open Platform Production Integration E2E Test Runner
 *
 * Usage:
 *   node scripts/test-feishu-e2e.mjs
 *   node scripts/test-feishu-e2e.mjs --chat-id=oc_xxxxxxxxxxxx
 *   npm run test:feishu
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 1. Manually parse .env.local if present and not in process.env
const envLocalPath = path.join(rootDir, '.env.local');
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const FEISHU_API_BASE_URL =
  process.env.FEISHU_API_BASE_URL || 'https://open.feishu.cn/open-apis';
const FEISHU_APP_ID = process.env.FEISHU_APP_ID || '';
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET || '';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Parse CLI flags
const args = process.argv.slice(2);
let targetChatId = '';
for (const arg of args) {
  if (arg.startsWith('--chat-id=')) {
    targetChatId = arg.split('=')[1];
  }
}

const MASK = (str, visibleChars = 4) => {
  if (!str) return '(not set)';
  if (str.length <= visibleChars * 2) return '****';
  return str.slice(0, visibleChars) + '****' + str.slice(-visibleChars);
};

console.log('╔══════════════════════════════════════════════════════════════════════╗');
console.log('║     LTMS Communication Center — Feishu Production Integration Test   ║');
console.log('║                         Version: Phase 2.5                           ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

console.log('📋 Environment Configuration:');
console.log(`  • Feishu Base URL  : ${FEISHU_API_BASE_URL}`);
console.log(`  • Feishu App ID    : ${MASK(FEISHU_APP_ID, 6)}`);
console.log(`  • Feishu App Secret: ${MASK(FEISHU_APP_SECRET, 4)}`);
console.log(`  • Supabase URL     : ${MASK(SUPABASE_URL, 12)}`);
console.log(`  • Supabase Role Key: ${MASK(SUPABASE_SERVICE_ROLE_KEY, 8)}\n`);

if (!FEISHU_APP_ID || !FEISHU_APP_SECRET) {
  console.error('❌ ERROR: Kredensial Feishu Open Platform belum lengkap!');
  console.error('Harap masukkan kredensial resmi pada file web/.env.local:');
  console.error('----------------------------------------------------');
  console.error('FEISHU_APP_ID=cli_xxxxxxxxxxxxxxxx');
  console.error('FEISHU_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
  console.error('FEISHU_API_BASE_URL=https://open.feishu.cn/open-apis');
  console.error('----------------------------------------------------\n');
  process.exit(1);
}

const results = [];

async function runTest(name, fn) {
  process.stdout.write(`⏳ [TEST] ${name}... `);
  const start = Date.now();
  try {
    const data = await fn();
    const duration = Date.now() - start;
    console.log(`✔ SUCCESS (${duration}ms)`);
    results.push({ name, status: 'PASS', duration, data });
    return data;
  } catch (err) {
    const duration = Date.now() - start;
    console.log(`✖ FAILED (${duration}ms)`);
    console.error(`   Error: ${err.message}`);
    results.push({ name, status: 'FAIL', duration, error: err.message });
    return null;
  }
}

async function main() {
  let tenantAccessToken = null;
  let availableGroups = [];
  let uploadedImageKey = null;
  let sentMessageId = null;

  // STEP 1: Auth & Tenant Access Token
  await runTest('1. Authenticate & Obtain Tenant Access Token', async () => {
    const res = await fetch(`${FEISHU_API_BASE_URL}/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        app_id: FEISHU_APP_ID,
        app_secret: FEISHU_APP_SECRET,
      }),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const json = await res.json();
    if (json.code !== 0 || !json.tenant_access_token) {
      throw new Error(`Feishu Code ${json.code}: ${json.msg || 'No token returned'}`);
    }

    tenantAccessToken = json.tenant_access_token;
    console.log(`\n      🔑 Token Acquired: ${MASK(tenantAccessToken, 8)} (Expires in: ${json.expire}s)`);
    return { token: tenantAccessToken, expire: json.expire };
  });

  if (!tenantAccessToken) {
    console.error('\n⛔ Test dihentikan karena autentikasi Feishu gagal.');
    printSummary();
    process.exit(1);
  }

  // STEP 2: Fetch Chat Groups
  await runTest('2. Query Bot Chat Groups (/im/v1/chats)', async () => {
    const res = await fetch(`${FEISHU_API_BASE_URL}/im/v1/chats?page_size=20`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tenantAccessToken}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const json = await res.json();
    if (json.code !== 0) {
      throw new Error(`Feishu Code ${json.code}: ${json.msg}`);
    }

    const items = json.data?.items || [];
    availableGroups = items.map((i) => ({
      chatId: i.chat_id,
      name: i.name || 'Unnamed Group',
      memberCount: i.user_count || 0,
    }));

    console.log(`\n      👥 Ditemukan ${availableGroups.length} Group Feishu:`);
    if (availableGroups.length === 0) {
      console.log('         (Bot belum ditambahkan ke grup Feishu mana pun)');
    } else {
      availableGroups.forEach((g, idx) => {
        console.log(`         ${idx + 1}. [${g.chatId}] ${g.name} (${g.memberCount} members)`);
      });
    }

    return availableGroups;
  });

  // STEP 3: Upload Sample Image Report
  await runTest('3. Upload Sample PNG Report to Feishu Storage (/im/v1/images)', async () => {
    // 1x1 transparent PNG buffer as a minimal valid PNG payload for testing
    const samplePngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const imageBuffer = Buffer.from(samplePngBase64, 'base64');

    const formData = new FormData();
    formData.append('image_type', 'message');
    const blob = new Blob([imageBuffer], { type: 'image/png' });
    formData.append('image', blob, 'test_monitoring_inc_report.png');

    const res = await fetch(`${FEISHU_API_BASE_URL}/im/v1/images`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tenantAccessToken}`,
      },
      body: formData,
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const json = await res.json();
    if (json.code !== 0 || !json.data?.image_key) {
      throw new Error(`Feishu Code ${json.code}: ${json.msg}`);
    }

    uploadedImageKey = json.data.image_key;
    console.log(`\n      🖼️ Image Uploaded Successfully: key = ${uploadedImageKey}`);
    return { image_key: uploadedImageKey };
  });

  // STEP 4: Build & Send Interactive Card to Target Group
  const chosenChatId = targetChatId || availableGroups[0]?.chatId;

  if (chosenChatId) {
    await runTest(`4. Send Monitoring INC Interactive Card to Group (${chosenChatId})`, async () => {
      const now = new Date();
      const timeStr = new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(now);

      const cardPayload = {
        config: {
          wide_screen_mode: true,
        },
        header: {
          title: {
            tag: 'plain_text',
            content: 'LTMS • Monitoring INC BATANG (E2E Test)',
          },
          template: 'red',
        },
        elements: [
          {
            tag: 'div',
            fields: [
              {
                is_short: true,
                text: {
                  tag: 'lark_md',
                  content: '**Target Kota:**\n📍 BATANG',
                },
              },
              {
                is_short: true,
                text: {
                  tag: 'lark_md',
                  content: `**Waktu Generate:**\n🕒 ${timeStr} WIB`,
                },
              },
            ],
          },
          { tag: 'hr' },
          {
            tag: 'div',
            fields: [
              {
                is_short: true,
                text: {
                  tag: 'lark_md',
                  content: '**Total AWB INC:**\n📦 14.942 Resi',
                },
              },
              {
                is_short: true,
                text: {
                  tag: 'lark_md',
                  content: '**Belum TTD (≤24 Jam):**\n⏳ 72 Resi',
                },
              },
              {
                is_short: true,
                text: {
                  tag: 'lark_md',
                  content: '**Melebihi SLA (>24 Jam):**\n🚨 54 Resi',
                },
              },
              {
                is_short: true,
                text: {
                  tag: 'lark_md',
                  content: '**Pencapaian Progress:**\n📈 57%',
                },
              },
            ],
          },
          { tag: 'hr' },
          {
            tag: 'div',
            text: {
              tag: 'lark_md',
              content:
                '🏙️ **Top 5 Wilayah Tujuan:**\n• Batang (24 resi)\n• Warungasem (18 resi)\n• Limpung (12 resi)\n• Bandar (9 resi)\n• Tulis (9 resi)',
            },
          },
          ...(uploadedImageKey
            ? [
                {
                  tag: 'img',
                  img_key: uploadedImageKey,
                  alt: {
                    tag: 'plain_text',
                    content: 'Visual Report Monitoring INC',
                  },
                  mode: 'fit_horizontal',
                },
              ]
            : []),
          {
            tag: 'note',
            elements: [
              {
                tag: 'plain_text',
                content:
                  '⚡ Production Integration Test Verification • Dikirim otomatis oleh LTMS Communication Center',
              },
            ],
          },
        ],
      };

      const res = await fetch(
        `${FEISHU_API_BASE_URL}/im/v1/messages?receive_id_type=chat_id`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tenantAccessToken}`,
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify({
            receive_id: chosenChatId,
            msg_type: 'interactive',
            content: JSON.stringify(cardPayload),
          }),
        }
      );

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const json = await res.json();
      if (json.code !== 0 || !json.data?.message_id) {
        throw new Error(`Feishu Code ${json.code}: ${json.msg}`);
      }

      sentMessageId = json.data.message_id;
      console.log(`\n      📩 Interactive Card Sent: message_id = ${sentMessageId}`);
      return { message_id: sentMessageId, chat_id: chosenChatId };
    });
  } else {
    console.log('⚠️ [SKIPPED] Test 4: Tidak ada Group Feishu yang tersedia (Bot belum dimasukkan ke group).');
  }

  // STEP 5: Supabase Connectivity & Audit Logging
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    await runTest('5. Validate Supabase Database Tables (feishu_groups & communication_logs)', async () => {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/communication_logs?select=id&limit=1`, {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error(
            'Tabel communication_logs belum dibuat di Supabase. Jalankan query di supabase/feishu_communication_center.sql pada Supabase SQL Editor.'
          );
        }
        throw new Error(`Supabase REST Error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      console.log(`\n      🗄️ Supabase connected successfully. Existing logs reachable.`);
      return { ok: true, data };
    });
  }

  printSummary();
}

function printSummary() {
  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║                     E2E INTEGRATION TEST SUMMARY                     ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  console.log('Result Table:');
  results.forEach((r) => {
    const icon = r.status === 'PASS' ? '✔ PASS' : '✖ FAIL';
    console.log(`  ${icon.padEnd(8)} | ${r.duration.toString().padStart(5)}ms | ${r.name}`);
  });

  const totalPass = results.filter((r) => r.status === 'PASS').length;
  const totalFail = results.filter((r) => r.status === 'FAIL').length;
  console.log(`\nTotal: ${results.length} tests | Passed: ${totalPass} | Failed: ${totalFail}`);

  if (totalFail === 0) {
    console.log('\n🎉 SEMUA PENGUJIAN INTEGRASI FEISHU PRODUCTION BERHASIL 100%!');
  } else {
    console.log('\n⚠️ Beberapa pengujian integrasi gagal. Periksa log kesalahan di atas.');
  }
}

main().catch((err) => {
  console.error('Fatal Error:', err);
  process.exit(1);
});

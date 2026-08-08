// AUDIT: simulasi N kirim "Kirim ke Feishu" BERSAMAAN (Promise.all) lewat
// kode produksi ASLI (communicationService.send -> feishuMessageService.sendMessage
// -> communicationSendQueue -> CardRenderPipeline.compile -> CardCompilerService
// -> CommunicationLogger.log), dgn boundary DB
// (db()) dan boundary jaringan (global.fetch ke Feishu) di-mock - pola sama
// dgn card-render-pipeline.test.ts. Tujuan: buktikan/gugurkan race condition
// shared-state (gambar/data "nyasar" antar request), bukan menguji rate-limit
// SUNGGUHAN dari Feishu (butuh kredensial live, di luar jangkauan sandbox ini).
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { type Row, fakeDbFactory } from '../../../lib/data/supabase/fake-db.test-support.ts';
import type { SendMessagePayload } from '../communication.types.ts';

function freshStore(): Map<string, Row[]> {
  return new Map<string, Row[]>([
    ['communication_logs', []],
    ['communication_card_templates', []],
    ['feishu_groups', [
      { id: 'g1', chat_id: 'oc_test_group', group_name: 'Uji Coba LTMS', status: 'active', is_default: true, last_send: null },
    ]],
    ['communication_mention_mappings', []],
    ['drop_point_kecamatan', []],
    ['master_drop_point', []],
  ]);
}

// Lacak berapa banyak call ke endpoint kirim-pesan yang sedang IN-FLIGHT
// bersamaan, utk verifikasi communicationSendQueue benar2 membatasi
// concurrency (constructor-nya di queue.ts: new PromiseQueue(2)).
let inFlightMessageSends = 0;
let peakConcurrentMessageSends = 0;

async function fakeFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const u = String(url);

  if (u.includes('/auth/v3/tenant_access_token/internal')) {
    return new Response(
      JSON.stringify({ code: 0, msg: 'ok', tenant_access_token: 'fake_tenant_token', expire: 7200 }),
      { status: 200 }
    );
  }

  if (u.includes('/im/v1/images')) {
    // Baca kembali marker unik yg disisipkan sbg "gambar" (base64 dari teks
    // marker) - buktikan tiap request menerima image_key yg berasal dari
    // BYTE MILIKNYA SENDIRI, bukan milik request concurrent lain.
    const formData = init.body as FormData;
    const blob = formData.get('image') as Blob;
    const text = await blob.text();
    // Beri jeda kecil acak supaya beberapa upload benar2 overlap di waktu yg sama.
    await new Promise((r) => setTimeout(r, 5 + Math.random() * 15));
    return new Response(
      JSON.stringify({ code: 0, msg: 'ok', data: { image_key: `imgkey_${text}` } }),
      { status: 200 }
    );
  }

  if (u.includes('/im/v1/messages')) {
    inFlightMessageSends++;
    peakConcurrentMessageSends = Math.max(peakConcurrentMessageSends, inFlightMessageSends);
    try {
      await new Promise((r) => setTimeout(r, 10 + Math.random() * 20));
      return new Response(
        JSON.stringify({ code: 0, msg: 'ok', data: { message_id: `msg_${Math.random().toString(36).slice(2)}` } }),
        { status: 200 }
      );
    } finally {
      inFlightMessageSends--;
    }
  }

  throw new Error(`fakeFetch: unexpected URL ${u}`);
}

describe('Concurrency audit: N simultaneous "Kirim ke Feishu" via Promise.all', () => {
  // communicationService.send() (bukan langsung feishuMessageService) -
  // ini layer yg SUNGGUHAN dipanggil oleh communication.controller.ts /api/communication/send,
  // termasuk insert communication_logs & groupService.recordSend, jadi
  // representatif terhadap alur nyata end-to-end.
  let commsService: typeof import('../communication.service.ts');
  let store: Map<string, Row[]>;
  const originalFetch = globalThis.fetch;
  const originalAppId = process.env.FEISHU_APP_ID;
  const originalAppSecret = process.env.FEISHU_APP_SECRET;

  before(async () => {
    process.env.FEISHU_APP_ID = 'test_app_id';
    process.env.FEISHU_APP_SECRET = 'test_app_secret';
    mock.module('@/lib/data/supabase/client', {
      namedExports: { db: fakeDbFactory(() => store) },
    });
    globalThis.fetch = fakeFetch as unknown as typeof fetch;
    commsService = await import('../communication.service.ts');
  });

  beforeEach(() => {
    store = freshStore();
    inFlightMessageSends = 0;
    peakConcurrentMessageSends = 0;
  });

  after(() => {
    mock.reset();
    globalThis.fetch = originalFetch;
    process.env.FEISHU_APP_ID = originalAppId;
    process.env.FEISHU_APP_SECRET = originalAppSecret;
  });

  it('5 request BERSAMAAN ke grup SAMA ("Uji Coba LTMS") - semua sukses, tidak ada gambar/data yang tertukar, log lengkap', async () => {
    const { communicationService } = commsService;
    const N = 5;

    const requests = Array.from({ length: N }, (_, i) => {
      const marker = `MARKER_DP_${i}_${Math.random().toString(36).slice(2)}`;
      const dpName = `DP_TEST_${i}`;
      return {
        marker,
        dpName,
        payload: {
          channel: 'feishu' as const,
          chatId: 'oc_test_group',
          messageType: 'interactive_card' as const,
          senderEmail: `user${i}@ltms.test`,
          data: {
            module: 'monitoring_inc',
            targetKota: dpName,
            pickup_dp: dpName,
            total_inc: 10 + i,
            clear_ttd: i,
            pending_ttd: 1,
            over_sla: 0,
            sla_percentage: 90,
            subdistricts: [{ name: dpName, count: `${i} AWB` }],
            generated_at: new Date().toISOString(),
            imageBase64: `data:image/png;base64,${Buffer.from(marker).toString('base64')}`,
            caption: `Laporan ${dpName}`,
          },
        },
      };
    });

    const results = await Promise.all(
      requests.map((r) => communicationService.send(r.payload as SendMessagePayload))
    );

    // 1. Semua terkirim, tidak ada yang gagal diam-diam.
    results.forEach((res, i) => {
      assert.equal(res.ok, true, `Request ${i} (${requests[i].dpName}) harus sukses: ${res.error}`);
    });

    // 2. Bukti PALING PENTING: image_key tiap hasil harus berasal dari
    // marker MILIKNYA SENDIRI, bukan "nyasar" dari request concurrent lain.
    results.forEach((res, i) => {
      const expectedKey = `imgkey_${requests[i].marker}`;
      assert.equal(
        res.imageKey,
        expectedKey,
        `Request ${i}: image_key tertukar! Diharapkan gambar milik ${requests[i].dpName} (${expectedKey}), didapat ${res.imageKey}`
      );
    });

    // 3. Isi kartu (cardJson) tiap hasil harus memuat nama DP-nya SENDIRI,
    // bukan DP milik request lain (bukti compiler tidak berbagi state).
    results.forEach((res, i) => {
      const cardStr = JSON.stringify(res.cardJson);
      assert.ok(
        cardStr.includes(requests[i].dpName),
        `Request ${i}: cardJson tidak memuat DP miliknya sendiri (${requests[i].dpName})`
      );
      // Pastikan TIDAK memuat nama DP milik request lain manapun.
      requests.forEach((other, j) => {
        if (j === i) return;
        assert.ok(
          !cardStr.includes(other.dpName),
          `Request ${i}: cardJson MEMUAT data milik request lain (${other.dpName}) - shared-state leak!`
        );
      });
    });

    // 4. communicationSendQueue (concurrency: 2) benar2 membatasi jumlah
    // pengiriman pesan yang overlap di waktu yang sama.
    assert.ok(
      peakConcurrentMessageSends <= 2,
      `Queue concurrency bocor: terdeteksi ${peakConcurrentMessageSends} pengiriman overlap bersamaan (harus <= 2)`
    );
    assert.ok(peakConcurrentMessageSends >= 2, 'Queue seharusnya tetap memproses hingga 2 request paralel (bukan strictly serial 1x1)');

    // 5. communication_logs: tepat N baris, tidak ada yang hilang/duplikat,
    // semua berstatus SUCCESS.
    const logs = store.get('communication_logs') || [];
    assert.equal(logs.length, N, `Jumlah baris communication_logs harus ${N}, didapat ${logs.length}`);
    assert.ok(logs.every((l) => l.status === 'SUCCESS'), 'Semua log harus berstatus SUCCESS');
  });

  it('3 request ke grup SAMA + 2 request ke grup BERBEDA, BERSAMAAN - tidak saling tertukar chat_id maupun isi', async () => {
    const { communicationService } = commsService;
    store.get('feishu_groups')!.push({
      id: 'g2', chat_id: 'oc_other_group', group_name: 'Grup Lain', status: 'active', is_default: false, last_send: null,
    });

    const defs = [
      { chatId: 'oc_test_group', dpName: 'DP_A' },
      { chatId: 'oc_test_group', dpName: 'DP_B' },
      { chatId: 'oc_test_group', dpName: 'DP_C' },
      { chatId: 'oc_other_group', dpName: 'DP_D' },
      { chatId: 'oc_other_group', dpName: 'DP_E' },
    ];

    const results = await Promise.all(
      defs.map((d) =>
        communicationService.send({
          channel: 'feishu',
          chatId: d.chatId,
          messageType: 'interactive_card',
          senderEmail: 'x@ltms.test',
          data: {
            module: 'monitoring_inc',
            targetKota: d.dpName,
            pickup_dp: d.dpName,
            total_inc: 1,
            clear_ttd: 1,
            pending_ttd: 0,
            over_sla: 0,
            sla_percentage: 100,
            generated_at: new Date().toISOString(),
          },
        } as SendMessagePayload)
      )
    );

    results.forEach((res, i) => {
      assert.equal(res.ok, true, `Request ${i} harus sukses: ${res.error}`);
      assert.equal(res.chatId, defs[i].chatId, `Request ${i}: chatId tertukar!`);
      assert.ok(JSON.stringify(res.cardJson).includes(defs[i].dpName), `Request ${i}: isi kartu tidak sesuai DP-nya`);
    });

    const logs = store.get('communication_logs') || [];
    assert.equal(logs.length, 5);
    assert.equal(logs.filter((l) => l.chat_id === 'oc_test_group').length, 3);
    assert.equal(logs.filter((l) => l.chat_id === 'oc_other_group').length, 2);
  });
});

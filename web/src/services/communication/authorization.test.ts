import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CommunicationAuthorizationService,
  type UserCommunicationScope,
} from './utils/authorization.ts';
import { FeishuCardService } from './providers/feishu/card.service.ts';
import { FeishuCardBuilder } from './providers/feishu/card.builder.ts';
import type { SendMessagePayload, GenericReportData } from './communication.types.ts';

describe('Communication Center: Role Scopes & Authorization Layer', () => {
  const authService = new CommunicationAuthorizationService();

  const superAdminScope: UserCommunicationScope = {
    actorId: 'usr_super_admin',
    email: 'superadmin@ltms.com',
    namaTampilan: 'Super Admin',
    role: 'Super Admin',
    dropPoint: '',
    isSuperAdmin: true,
    isCabangLevel: true,
    isKotaLevel: false,
    isSpvLevel: false,
    isDpLevel: false,
    allowedKota: null,
    allowedDropPoints: null,
  };

  const adminCabangScope: UserCommunicationScope = {
    actorId: 'usr_admin_cabang',
    email: 'admincabang@ltms.com',
    namaTampilan: 'Admin Cabang',
    role: 'Admin Cabang',
    dropPoint: '',
    isSuperAdmin: false,
    isCabangLevel: true,
    isKotaLevel: false,
    isSpvLevel: false,
    isDpLevel: false,
    allowedKota: null,
    allowedDropPoints: null,
  };

  const managerKotaBatangScope: UserCommunicationScope = {
    actorId: 'usr_manager_batang',
    email: 'manager.batang@ltms.com',
    namaTampilan: 'Manager Kota Batang',
    role: 'Manager Kota',
    dropPoint: '',
    isSuperAdmin: false,
    isCabangLevel: true,
    isKotaLevel: true,
    isSpvLevel: false,
    isDpLevel: false,
    allowedKota: ['BATANG', 'KAB. BATANG'],
    allowedDropPoints: ['BATANG01', 'BATANG02', 'LIMPUNG01'],
  };

  const spvDropPointScope: UserCommunicationScope = {
    actorId: 'usr_spv_batang',
    email: 'spv.batang@ltms.com',
    namaTampilan: 'SPV Batang Area',
    role: 'SPV Drop Point',
    dropPoint: '',
    isSuperAdmin: false,
    isCabangLevel: false,
    isKotaLevel: false,
    isSpvLevel: true,
    isDpLevel: false,
    allowedKota: ['BATANG'],
    allowedDropPoints: ['BATANG01', 'BATANG02'],
  };

  const adminDpScope: UserCommunicationScope = {
    actorId: 'usr_admin_dp_batang01',
    email: 'admindp@ltms.com',
    namaTampilan: 'Admin DP Batang 01',
    role: 'Admin DP',
    dropPoint: 'BATANG01',
    isSuperAdmin: false,
    isCabangLevel: false,
    isKotaLevel: false,
    isSpvLevel: false,
    isDpLevel: true,
    allowedKota: ['BATANG'],
    allowedDropPoints: ['BATANG01'],
  };

  it('1. Super Admin has unrestricted access across any target scope or city', () => {
    const payload: SendMessagePayload = {
      channel: 'feishu',
      chatId: 'oc_test',
      messageType: 'interactive_card',
      data: {
        targetKota: 'PEKALONGAN',
        targetScope: { type: 'all', name: 'Seluruh Cabang' },
      },
    };

    const res = authService.validateDataScope(superAdminScope, payload);
    assert.equal(res.allowed, true);
  });

  it('2. Admin Cabang can broadcast cabang-level and any city in the branch', () => {
    const payload: SendMessagePayload = {
      channel: 'feishu',
      chatId: 'oc_test',
      messageType: 'interactive_card',
      data: {
        targetKota: 'BATANG',
        targetScope: { type: 'cabang', name: 'Cabang Batang' },
      },
    };

    const res = authService.validateDataScope(adminCabangScope, payload);
    assert.equal(res.allowed, true);
  });

  it('3. Manager Kota can send report for their assigned city (BATANG)', () => {
    const payload: SendMessagePayload = {
      channel: 'feishu',
      chatId: 'oc_test',
      messageType: 'interactive_card',
      data: {
        targetKota: 'BATANG',
      },
    };

    const res = authService.validateDataScope(managerKotaBatangScope, payload);
    assert.equal(res.allowed, true);
  });

  it('4. Manager Kota is rejected when trying to send report for unassigned city (KUDUS)', () => {
    const payload: SendMessagePayload = {
      channel: 'feishu',
      chatId: 'oc_test',
      messageType: 'interactive_card',
      data: {
        targetKota: 'KUDUS',
      },
    };

    const res = authService.validateDataScope(managerKotaBatangScope, payload);
    assert.equal(res.allowed, false);
    assert.match(res.reason || '', /tidak memiliki wewenang untuk membagikan data Kota "KUDUS"/);
  });

  it('5. SPV Drop Point can send report for supervised Drop Point (BATANG01)', () => {
    const payload: SendMessagePayload = {
      channel: 'feishu',
      chatId: 'oc_test',
      messageType: 'interactive_card',
      data: {
        targetDp: 'BATANG01',
      },
    };

    const res = authService.validateDataScope(spvDropPointScope, payload);
    assert.equal(res.allowed, true);
  });

  it('6. SPV Drop Point is rejected when trying to send report for unsupervised Drop Point (PEKALONGAN01)', () => {
    const payload: SendMessagePayload = {
      channel: 'feishu',
      chatId: 'oc_test',
      messageType: 'interactive_card',
      data: {
        targetDp: 'PEKALONGAN01',
      },
    };

    const res = authService.validateDataScope(spvDropPointScope, payload);
    assert.equal(res.allowed, false);
    assert.match(res.reason || '', /tidak berada di bawah supervisi Anda/);
  });

  it('7. SPV Drop Point is rejected when trying to broadcast whole-cabang report', () => {
    const payload: SendMessagePayload = {
      channel: 'feishu',
      chatId: 'oc_test',
      messageType: 'interactive_card',
      data: {
        targetScope: { type: 'cabang', name: 'Cabang Batang' },
      },
    };

    const res = authService.validateDataScope(spvDropPointScope, payload);
    assert.equal(res.allowed, false);
    assert.match(res.reason || '', /tidak memiliki wewenang untuk membagikan laporan berskala seluruh Cabang/);
  });

  it('8. Admin DP can send report for own Drop Point (BATANG01)', () => {
    const payload: SendMessagePayload = {
      channel: 'feishu',
      chatId: 'oc_test',
      messageType: 'interactive_card',
      data: {
        targetDp: 'BATANG01',
      },
    };

    const res = authService.validateDataScope(adminDpScope, payload);
    assert.equal(res.allowed, true);
  });

  it('9. Admin DP is rejected when trying to send report for another Drop Point (BATANG02)', () => {
    const payload: SendMessagePayload = {
      channel: 'feishu',
      chatId: 'oc_test',
      messageType: 'interactive_card',
      data: {
        targetDp: 'BATANG02',
      },
    };

    const res = authService.validateDataScope(adminDpScope, payload);
    assert.equal(res.allowed, false);
    assert.match(res.reason || '', /hanya dapat membagikan data milik Drop Point sendiri/);
  });
});

describe('Communication Center: Multi-Module Card Builders', () => {
  const cardService = new FeishuCardService();

  it('10. Builds Delivery Card with blue theme and metrics', () => {
    const data: GenericReportData = {
      module: 'monitoring_delivery',
      targetDp: 'BATANG01',
      metrics: [
        { label: 'Total Resi Delivery', value: '1.250' },
        { label: 'Selesai TTD', value: '1.180', color: 'green' },
        { label: 'Pending / Gagal', value: '70', color: 'red' },
      ],
      generateTime: '5 Agu 2026 08:00',
    };

    const card = cardService.generateCard(data);
    assert.equal(card.header?.title.content, 'LTMS • Monitoring Delivery BATANG01');
    assert.equal(card.header?.template, 'blue');
    const elStr = JSON.stringify(card.elements);
    assert.ok(elStr.includes('Total Resi Delivery'));
    assert.ok(elStr.includes('1.250'));
  });

  it('11. Builds Dashboard Summary Card with indigo theme', () => {
    const data: GenericReportData = {
      module: 'dashboard',
      targetScope: { type: 'cabang', name: 'Batang Regional' },
      total: 50000,
      belum: 240,
      late: 12,
      percent: 99,
    };

    const card = cardService.generateCard(data);
    assert.equal(card.header?.title.content, 'LTMS • Ringkasan Dashboard BATANG REGIONAL');
    assert.equal(card.header?.template, 'indigo');
    const elStr = JSON.stringify(card.elements);
    assert.ok(elStr.includes('50.000'));
    assert.ok(elStr.includes('99%'));
  });

  it('12. Builds Longtail Card with orange theme', () => {
    const data: GenericReportData = {
      module: 'longtail',
      targetDp: 'BATANG02',
      metrics: [
        { label: 'Total Paket Long Tail', value: '45', color: 'orange' },
        { label: 'Umur > 7 Hari', value: '12', color: 'red' },
      ],
    };

    const card = cardService.generateCard(data);
    assert.equal(card.header?.title.content, 'LTMS • Laporan Long Tail BATANG02');
    assert.equal(card.header?.template, 'orange');
    const elStr = JSON.stringify(card.elements);
    assert.ok(elStr.includes('Total Paket Long Tail'));
  });

  it('13. Builds Generic Custom Card with custom title and header template', () => {
    const data: GenericReportData = {
      module: 'custom',
      title: 'Laporan SLA Akhir Bulan',
      headerTemplate: 'turquoise',
      targetScope: { type: 'kota', name: 'Pekalongan' },
      metrics: [{ label: 'Pencapaian SLA', value: '98.5%' }],
      notes: 'Laporan resmi bulanan regional.',
    };

    const card = cardService.generateCard(data);
    assert.equal(card.header?.title.content, 'Laporan SLA Akhir Bulan');
    assert.equal(card.header?.template, 'turquoise');
    const elStr = JSON.stringify(card.elements);
    assert.ok(elStr.includes('Pencapaian SLA'));
    assert.ok(elStr.includes('Laporan resmi bulanan regional.'));
  });
});

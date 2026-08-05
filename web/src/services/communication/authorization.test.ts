import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CommunicationAuthorizationService,
  type UserCommunicationScope,
} from './utils/authorization.ts';
import type { SendMessagePayload } from './communication.types.ts';

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

// Note: FeishuCardService.generateCard (multi-module title/theme derivation)
// had zero production callers and was removed along with card.service.ts /
// card.builder.ts. Multi-module compilation is covered directly against
// CardCompilerService in configuration/__tests__/template-engine.test.ts.

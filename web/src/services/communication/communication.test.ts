import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FeishuCardService } from './providers/feishu/card.service.ts';
import { MemoryCache } from './utils/cache.ts';
import { withRetry } from './utils/retry.ts';
import type { MonitoringIncSummaryData } from './communication.types.ts';

describe('Communication Center: Feishu Card Service', () => {
  const cardService = new FeishuCardService();

  const sampleData: MonitoringIncSummaryData = {
    targetKota: 'BATANG',
    total: 14942,
    belum: 72,
    late: 54,
    clear: 14816,
    percent: 57,
    topKecamatan: ['Batang', 'Warungasem', 'Limpung', 'Bandar', 'Tulis'],
    generateTime: '4 Agu 2026 23:30',
  };

  it('1. Generates valid Feishu Interactive Card structure with header and template', () => {
    const card = cardService.generateMonitoringIncCard(sampleData);

    assert.equal(card.header?.title.content, 'LTMS • Monitoring INC BATANG');
    assert.equal(card.header?.template, 'red');
    assert.equal(card.config?.wide_screen_mode, true);
    assert.ok(card.elements.length > 0);
  });

  it('2. Includes Target Kota and Metrics in Card elements', () => {
    const card = cardService.generateMonitoringIncCard(sampleData);
    const elementsStr = JSON.stringify(card.elements);

    assert.ok(elementsStr.includes('BATANG'));
    assert.ok(elementsStr.includes('14.942'));
    assert.ok(elementsStr.includes('72'));
    assert.ok(elementsStr.includes('54'));
    assert.ok(elementsStr.includes('57%'));
    assert.ok(elementsStr.includes('Warungasem'));
  });

  it('3. Attaches image element when imageKey is provided', () => {
    const card = cardService.generateMonitoringIncCard(sampleData, 'img_v2_sample_key_123');
    const imageEl = card.elements.find((el) => el.tag === 'img');

    assert.ok(imageEl, 'Image element should be present');
    assert.equal(imageEl.img_key, 'img_v2_sample_key_123');
    assert.equal(imageEl.mode, 'fit_horizontal');
  });

  it('4. Omits image element when imageKey is undefined', () => {
    const card = cardService.generateMonitoringIncCard(sampleData);
    const imageEl = card.elements.find((el) => el.tag === 'img');

    assert.equal(imageEl, undefined);
  });
});

describe('Communication Center: MemoryCache Utility', () => {
  it('5. Sets and gets values within TTL', () => {
    const cache = new MemoryCache();
    cache.set('token', 't-secret-123', 60);

    assert.equal(cache.get<string>('token'), 't-secret-123');
  });

  it('6. Returns null for non-existent or expired keys', async () => {
    const cache = new MemoryCache();
    cache.set('expiredKey', 'tempValue', 0.05); // 50ms TTL

    // Immediately available
    assert.equal(cache.get<string>('expiredKey'), 'tempValue');

    // Wait 100ms for expiration
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(cache.get<string>('expiredKey'), null);
  });
});

describe('Communication Center: withRetry Utility', () => {
  it('7. Resolves immediately when operation succeeds on first attempt', async () => {
    let attempts = 0;
    const result = await withRetry(async () => {
      attempts++;
      return 'SUCCESS';
    }, { maxAttempts: 3, initialDelayMs: 10 });

    assert.equal(result, 'SUCCESS');
    assert.equal(attempts, 1);
  });

  it('8. Retries and resolves when operation succeeds after transient failure', async () => {
    let attempts = 0;
    const result = await withRetry(async () => {
      attempts++;
      if (attempts < 3) throw new Error('Temporary Network Glitch');
      return 'RECOVERED';
    }, { maxAttempts: 3, initialDelayMs: 20 });

    assert.equal(result, 'RECOVERED');
    assert.equal(attempts, 3);
  });

  it('9. Throws error when max attempts are exceeded', async () => {
    let attempts = 0;
    await assert.rejects(
      async () => {
        await withRetry(async () => {
          attempts++;
          throw new Error('Persistent Failure');
        }, { maxAttempts: 3, initialDelayMs: 10 });
      },
      /Persistent Failure/
    );
    assert.equal(attempts, 3);
  });
});

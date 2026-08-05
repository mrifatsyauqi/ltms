import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryCache } from './utils/cache.ts';
import { withRetry } from './utils/retry.ts';
import { SlidingWindowRateLimiter } from './utils/rate-limiter.ts';
import { PromiseQueue } from './utils/queue.ts';
import {
  FeishuTokenResponseSchema,
  FeishuChatListResponseSchema,
  FeishuUploadImageResponseSchema,
  FeishuSendMessageResponseSchema,
} from './communication.schemas.ts';

// Note: Interactive Card generation is covered by
// configuration/__tests__/template-engine.test.ts, which exercises
// CardCompilerService directly — the single render pipeline's actual
// compiler. FeishuCardService/FeishuCardBuilder (which only wrapped it)
// had zero production callers and were removed.

describe('Communication Center: Zod Schema Validations', () => {
  it('6. Validates correct Feishu Token Response', () => {
    const validData = {
      code: 0,
      msg: 'ok',
      tenant_access_token: 't-g10492819827361',
      expire: 7140,
    };
    const parsed = FeishuTokenResponseSchema.safeParse(validData);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.tenant_access_token, 't-g10492819827361');
    }
  });

  it('7. Rejects invalid Feishu Token Response (missing code)', () => {
    const invalidData = {
      msg: 'no code here',
    };
    const parsed = FeishuTokenResponseSchema.safeParse(invalidData);
    assert.equal(parsed.success, false);
  });

  it('8. Validates Feishu Chat List Response', () => {
    const chatData = {
      code: 0,
      data: {
        has_more: false,
        page_token: '',
        items: [
          {
            chat_id: 'oc_12345',
            name: 'Group Batang',
            user_count: 25,
          },
        ],
      },
    };
    const parsed = FeishuChatListResponseSchema.safeParse(chatData);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.data?.items?.[0]?.chat_id, 'oc_12345');
    }
  });

  it('9. Validates Feishu Upload Image Response', () => {
    const imgData = {
      code: 0,
      data: {
        image_key: 'img_v2_abc123',
      },
    };
    const parsed = FeishuUploadImageResponseSchema.safeParse(imgData);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.data?.image_key, 'img_v2_abc123');
    }
  });

  it('10. Validates Feishu Send Message Response', () => {
    const sendData = {
      code: 0,
      msg: 'success',
      data: {
        message_id: 'om_987654321',
        chat_id: 'oc_12345',
      },
    };
    const parsed = FeishuSendMessageResponseSchema.safeParse(sendData);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.data?.message_id, 'om_987654321');
    }
  });
});

describe('Communication Center: Sliding Window Rate Limiter', () => {
  it('11. Allows requests within limit (max 5 per window)', () => {
    const limiter = new SlidingWindowRateLimiter(5, 5000);
    const user = 'admin@example.com';

    for (let i = 0; i < 5; i++) {
      const res = limiter.check(user);
      assert.equal(res.allowed, true, `Request ${i + 1} should be allowed`);
    }

    // 6th request should be blocked
    const blockedRes = limiter.check(user);
    assert.equal(blockedRes.allowed, false, '6th request must be blocked');
    assert.equal(blockedRes.remaining, 0);
  });

  it('12. Resets count after time window expires', async () => {
    const limiter = new SlidingWindowRateLimiter(2, 100); // 100ms window
    const user = 'admin2@example.com';

    assert.equal(limiter.check(user).allowed, true);
    assert.equal(limiter.check(user).allowed, true);
    assert.equal(limiter.check(user).allowed, false);

    // Wait 120ms
    await new Promise((r) => setTimeout(r, 120));

    // Allowed again
    assert.equal(limiter.check(user).allowed, true);
  });
});

describe('Communication Center: Promise Concurrency Queue', () => {
  it('13. Processes tasks sequentially and limits concurrency', async () => {
    const queue = new PromiseQueue(1);
    const executionOrder: number[] = [];

    const task1 = () =>
      new Promise<string>((resolve) => {
        setTimeout(() => {
          executionOrder.push(1);
          resolve('T1');
        }, 50);
      });

    const task2 = () =>
      new Promise<string>((resolve) => {
        setTimeout(() => {
          executionOrder.push(2);
          resolve('T2');
        }, 10);
      });

    const p1 = queue.add(task1);
    const p2 = queue.add(task2);

    const [r1, r2] = await Promise.all([p1, p2]);

    assert.equal(r1, 'T1');
    assert.equal(r2, 'T2');
    assert.deepEqual(executionOrder, [1, 2], 'Task 1 must complete before Task 2 starts');
  });
});

describe('Communication Center: MemoryCache Utility', () => {
  it('14. Sets and gets values within TTL', () => {
    const cache = new MemoryCache();
    cache.set('token', 't-secret-123', 60);

    assert.equal(cache.get<string>('token'), 't-secret-123');
  });

  it('15. Returns null for non-existent or expired keys', async () => {
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
  it('16. Resolves immediately when operation succeeds on first attempt', async () => {
    let attempts = 0;
    const result = await withRetry(async () => {
      attempts++;
      return 'SUCCESS';
    }, { maxAttempts: 3, initialDelayMs: 10 });

    assert.equal(result, 'SUCCESS');
    assert.equal(attempts, 1);
  });

  it('17. Retries and resolves when operation succeeds after transient failure', async () => {
    let attempts = 0;
    const result = await withRetry(async () => {
      attempts++;
      if (attempts < 3) throw new Error('Temporary Network Glitch');
      return 'RECOVERED';
    }, { maxAttempts: 3, initialDelayMs: 20 });

    assert.equal(result, 'RECOVERED');
    assert.equal(attempts, 3);
  });

  it('18. Throws error when max attempts are exceeded', async () => {
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

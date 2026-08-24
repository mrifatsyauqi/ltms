import { BablastClient } from '@bablast/client';
import { getBablastCredentials } from '../src/services/communication/communication.config';

async function testSdk() {
  const creds = await getBablastCredentials();
  const client = new BablastClient({ apiKey: creds.apiKey! });
  try {
    const res = await client.wa.senders.list();
    console.log('SDK Senders Response:', JSON.stringify(res, null, 2));
  } catch (e: any) {
    console.error('SDK Senders Error:', e.message);
  }
}
testSdk();

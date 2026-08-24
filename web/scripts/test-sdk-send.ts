import { BablastClient } from '@bablast/client';
import { getBablastCredentials } from '../src/services/communication/communication.config';

async function testSdk() {
  const creds = await getBablastCredentials();
  const client = new BablastClient({ apiKey: creds.apiKey! });
  console.log('client keys:', Object.keys(client));
  console.log('client.wa keys:', Object.keys((client as any).wa || {}));
  console.log('client.messages keys:', Object.keys((client as any).messages || {}));
}

testSdk();

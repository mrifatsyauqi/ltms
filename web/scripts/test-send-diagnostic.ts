import { getBablastCredentials } from '../src/services/communication/communication.config';

async function testSend() {
  const creds = await getBablastCredentials();
  if (!creds.isConfigured || !creds.apiKey) process.exit(1);

  async function trySend(code: string) {
    console.log(`\nSending message with sender_code = "${code}"`);
    let response = await fetch(`${creds.baseUrl}/send`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${creds.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '6282211700060',
        message: `Test message with sender_code ${code}`,
        sender_code: code
      })
    });
    let data = await response.json().catch(() => ({}));
    console.log(`Status (${code}):`, response.status, data);
  }

  await trySend('6282211700060:13');
  await trySend('Gheverhan');
}

testSend();

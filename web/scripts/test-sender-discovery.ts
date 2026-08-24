import { getBablastCredentials } from '../src/services/communication/communication.config';

const SENDER_PHONE = '6282211700060';

async function auditSender() {
  try {
    const creds = await getBablastCredentials();
    if (!creds.isConfigured || !creds.apiKey) {
      console.log('Error: API Key not found in DB');
      process.exit(1);
    }
    
    console.log('--- A. Sender Discovery ---');
    const discoveryRes = await fetch(`${creds.baseUrl}/wa/senders`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${creds.apiKey}` }
    });
    
    const senders = await discoveryRes.json().catch(() => ({}));
    console.log(`GET /wa/senders (Status: ${discoveryRes.status})`);
    
    let targetFromDiscovery = null;
    if (Array.isArray(senders.data)) {
      targetFromDiscovery = senders.data.find((s: any) => s.sender_id === SENDER_PHONE || s.phone === SENDER_PHONE);
      console.log(`Found ${senders.data.length} senders total.`);
    } else {
      console.log('Discovery data is not array:', senders);
    }
    
    if (targetFromDiscovery) {
      console.log(`[FOUND in Discovery] ->`, JSON.stringify(targetFromDiscovery, null, 2));
    } else {
      console.log(`[NOT FOUND in Discovery] (Sender ${SENDER_PHONE} is not in the list)`);
    }

    console.log('\n--- B. Connector Status ---');
    const statusRes = await fetch(`${creds.baseUrl}/connector/status?phone=${SENDER_PHONE}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${creds.apiKey}` }
    });
    
    const statusData = await statusRes.json().catch(() => ({}));
    console.log(`GET /connector/status (Status: ${statusRes.status})`);
    console.log(JSON.stringify(statusData, null, 2));

  } catch (err: any) {
    console.error('Audit failed:', err.message);
  }
}

auditSender();

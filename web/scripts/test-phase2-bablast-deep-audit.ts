import { config } from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) config({ path: envPath });

const BABLAST_API_URL = 'https://api.bablast.id';
const BABLAST_GLOBAL_API_KEY = process.env.BABLAST_API_KEY || 'bk_live_8-Ox-HphtEwZxGBYy42Jw16sKlm8gzQACQfyd9RWSX8';
const PHONE = '6282211700060';

async function audit() {
  console.log('==================================================');
  console.log('BABLAST INTEGRATION DIAGNOSTIC');
  console.log('==================================================');

  if (!BABLAST_GLOBAL_API_KEY) {
    console.log('API Key: NOT CONFIGURED');
    return;
  }
  console.log('API Key: CONFIGURED\n');

  const headers = {
    'Authorization': `Bearer ${BABLAST_GLOBAL_API_KEY}`,
    'Content-Type': 'application/json'
  };

  // 1. Audit /connector/status
  try {
    const statusRes = await fetch(`${BABLAST_API_URL}/connector/status?phone=${PHONE}`, { headers });
    const statusData = await statusRes.json();
    console.log('--- GET /connector/status ---');
    console.log(`Status: ${statusRes.status}`);
    console.log(JSON.stringify(statusData, null, 2));
    
    if (statusData.data?.isConnected === true || statusData.data?.sessionData?.isConnected === true) {
      console.log('Connector: CONNECTED');
    } else {
      console.log('Connector: DISCONNECTED');
    }
  } catch (e: any) {
    console.log('Connector: FAIL TO CHECK', e.message);
  }

  console.log(`\nPhone: ${PHONE}`);

  // 2. Audit sender discovery
  let senderObj = null;
  let sendersData = null;
  const endpointsToTry = ['/wa/senders', '/senders', '/device/list'];
  
  for (const ep of endpointsToTry) {
    try {
      console.log(`\n--- TRYING GET ${ep} ---`);
      const res = await fetch(`${BABLAST_API_URL}${ep}`, { headers });
      const textData = await res.text();
      console.log(`Status: ${res.status}`);
      try {
        sendersData = JSON.parse(textData);
        if (res.ok) {
          console.log('JSON Output (truncated):', JSON.stringify(sendersData).substring(0, 200));
          break;
        }
      } catch(e) {
        console.log('Response is not JSON. Text:', textData.substring(0, 100));
      }
    } catch (e: any) {
      console.log('Error hitting endpoint:', e.message);
    }
  }

  const sendersList = sendersData?.data || [];
  if (Array.isArray(sendersList)) {
    console.log(`\nTotal Senders: ${sendersList.length}`);
    senderObj = sendersList.find((s: any) => s.phone === PHONE || s.sender_id == PHONE || s.sender_code === PHONE);
    
    if (senderObj) {
      console.log('Sender Discovery: FOUND');
      console.log('Exact Sender Object:');
      console.log(JSON.stringify(senderObj, null, 2));
      
      if (senderObj.sender_code) {
        console.log('Sender Code: AVAILABLE');
      } else {
        console.log('Sender Code: NOT AVAILABLE');
      }
    } else {
      console.log('Sender Discovery: NOT FOUND');
    }
  } else {
    console.log('\nSender Discovery: FAILED (No valid list returned)');
  }

  // 3. Try Send API
  console.log('\n--- POST /send (Test Sending) ---');
  if (senderObj) {
    const senderCode = senderObj.sender_code || senderObj.id || senderObj.sender_id || PHONE;
    console.log(`Using inferred sender_code for test: ${senderCode}`);
    
    const payload = {
      phone: '6281575652263',
      message: 'Deep Audit Diagnostic Test',
      sender_code: senderCode
    };

    try {
      const sendRes = await fetch(`${BABLAST_API_URL}/send`, { method: 'POST', headers, body: JSON.stringify(payload) });
      const sendData = await sendRes.json();
      console.log(`Status: ${sendRes.status}`);
      console.log(JSON.stringify(sendData, null, 2));
    } catch (e: any) {
      console.log('Send API: FAIL', e.message);
    }
  } else {
    console.log('Send API: SKIPPED (Sender Not Found in API)');
    
    // Fallback: try sending with PHONE as sender_code
    console.log(`\nFallback: Testing /send using ${PHONE} as sender_code blindly...`);
    const payload = {
      phone: '6281575652263',
      message: 'Deep Audit Diagnostic Test Fallback',
      sender_code: PHONE
    };
    try {
      const sendRes = await fetch(`${BABLAST_API_URL}/send`, { method: 'POST', headers, body: JSON.stringify(payload) });
      const sendData = await sendRes.json();
      console.log(`Status: ${sendRes.status}`);
      console.log(JSON.stringify(sendData, null, 2));
    } catch (e: any) {}
  }
}

audit();

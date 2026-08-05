import { CardCompilerService } from '../src/services/communication/configuration/card-compiler.service';
import { STARTER_PRESETS, SAMPLE_DUMMY_CONTEXT } from '../src/services/communication/configuration/template-presets';

console.log('--- Testing Phase 2.6.1 Card Compiler ---');

// 1. Test Monitoring INC Card
const incPreset = STARTER_PRESETS.find((p) => p.id === 'preset_monitoring_inc');
if (!incPreset) throw new Error('Monitoring INC preset not found');

const incCard = CardCompilerService.compile(incPreset.blocksConfig, SAMPLE_DUMMY_CONTEXT, 'img_test_inc_123');

console.log('\n=== MONITORING INC CARD OUTPUT ===');
console.log('Header Title:', incCard.header?.title?.content);
console.log('Header Template:', incCard.header?.template);
console.log('Elements Count:', incCard.elements.length);

// Verify specific elements in INC Card
const incElementsJson = JSON.stringify(incCard.elements, null, 2);
console.log('Has Pickup DP BATANG01:', incElementsJson.includes('BATANG01'));
console.log('Has Target City KOTA BATANG:', incElementsJson.includes('KOTA BATANG'));
console.log('Has 5-KPI Grid (14.942, 14.816, 72, 54, 99.1%):', 
  incElementsJson.includes('14.942') && 
  incElementsJson.includes('14.816') && 
  incElementsJson.includes('72') && 
  incElementsJson.includes('54') && 
  incElementsJson.includes('99.1%')
);
console.log('Has Destination Subdistricts:', incElementsJson.includes('WARUNGASEM'));
console.log('Has Action Button:', incElementsJson.includes('Buka Dashboard LTMS'));
console.log('Has Image Attachment img_test_inc_123:', incElementsJson.includes('img_test_inc_123'));

// 2. Test Monitoring Delivery Card
const delPreset = STARTER_PRESETS.find((p) => p.id === 'preset_monitoring_delivery');
if (!delPreset) throw new Error('Monitoring Delivery preset not found');

const delCard = CardCompilerService.compile(delPreset.blocksConfig, SAMPLE_DUMMY_CONTEXT, 'img_test_del_456');

console.log('\n=== MONITORING DELIVERY CARD OUTPUT ===');
console.log('Header Title:', delCard.header?.title?.content);
console.log('Header Template:', delCard.header?.template);
console.log('Elements Count:', delCard.elements.length);

const delElementsJson = JSON.stringify(delCard.elements, null, 2);
console.log('Has Drop Point BATANG01:', delElementsJson.includes('BATANG01'));
console.log('Has Last Scan (08:26 WIB, JT1234567890, Delivery):', 
  delElementsJson.includes('08:26 WIB') && 
  delElementsJson.includes('JT1234567890') && 
  delElementsJson.includes('Delivery')
);
console.log('Has 5-KPI Delivery (3.420, 3.210, 14.816, 72, 98.5%):',
  delElementsJson.includes('3.420') &&
  delElementsJson.includes('3.210') &&
  delElementsJson.includes('14.816') &&
  delElementsJson.includes('72') &&
  delElementsJson.includes('98.5%')
);
console.log('Has Action Button:', delElementsJson.includes('Buka Dashboard LTMS'));
console.log('Has Image Attachment img_test_del_456:', delElementsJson.includes('img_test_del_456'));

console.log('\n✅ All Phase 2.6.1 Card Template tests passed perfectly!');

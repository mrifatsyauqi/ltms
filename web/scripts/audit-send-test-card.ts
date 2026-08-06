import { CardCompilerService } from '../src/services/communication/configuration/card-compiler.service';
import { STARTER_PRESETS } from '../src/services/communication/configuration/template-presets';

const preset = STARTER_PRESETS.find((p) => p.id === 'preset_monitoring_inc');
if (!preset) throw new Error('preset not found');

const MOCK_PREVIEW_VARIABLES = {
  pickup_dp: 'BATANG01',
  target_city: 'KOTA BATANG',
  drop_point: 'BATANG01',
  total_inc: '14.942',
  clear_ttd: '14.816',
  pending_ttd: '72',
  over_sla: '54',
  sla_percentage: '99.1',
  total_delivery: '3.240',
  delivered: '3.198',
  pending_delivery: '42',
  delivery_sla: '98.0',
  last_scan_time: '08:21 WIB',
  last_scan_awb: 'JT1234567890',
  last_scan_status: 'Delivery',
  generated_at: new Date().toLocaleString('id-ID'),
  subdistricts: [
    { name: 'BATANG', count: '10 AWB', picName: 'Agus Supriyanto' },
    { name: 'WARUNGASEM', count: '8 AWB', picName: 'Dimas Prasetyo' },
    { name: 'LIMPUNG', count: '6 AWB', picName: 'Rian Hidayat' },
    { name: 'BANDAR', count: '5 AWB', picName: 'Arif Munandar' },
  ],
  kurirList: [
    { name: 'Andi Setiawan', count: '12 Paket' },
    { name: 'Rudi Hermawan', count: '8 Paket' },
  ],
  module: 'monitoring_inc',
};

// Tanpa mention map / tanpa imageKey -- persis kondisi Send Test tanpa upload gambar
const card = CardCompilerService.compileCard(preset.blocksConfig, MOCK_PREVIEW_VARIABLES);
console.log(JSON.stringify(card, null, 2));
console.log('\n--- content string length (yg dikirim sbg field `content` ke Feishu) ---');
console.log(JSON.stringify(card).length);

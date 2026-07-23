import { CANONICAL_FIELDS, type CanonicalField, type HeaderMapping } from './types';

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Known header spellings from JMS-style Excel exports, normalized (no spaces/punctuation). Extend as real export files reveal new variants. */
const ALIASES: Record<CanonicalField, string[]> = {
  noWaybill: ['nowaybill', 'waybill', 'noresi', 'resi', 'awb', 'airwaybill', 'nomorwaybill'],
  statusTerakhir: ['statusterakhir', 'status', 'laststatus'],
  alasanBermasalah: ['alasanpaketbermasalah', 'alasanbermasalah', 'alasan', 'problemreason', 'keterangan'],
  dpSampai: ['dpsampai', 'droppoint', 'dp', 'destinationdp', 'dptujuan'],
  waktuSampai: ['waktusampai', 'tanggalsampai', 'receiveddate', 'tanggalterima'],
  sprinterDelivery: ['sprinterdelivery', 'sprinter', 'kurir', 'courier'],
  cod: ['cod', 'nilaicod', 'cashondelivery'],
  deliveryAttempt: ['deliveryattempt', 'attempt', 'percobaanpengiriman', 'jumlahattempt'],
};

/** Best-effort auto mapping (PRD Bagian 7.2). Headers that don't match anything map to null — the UI must let the user fix those manually before Import is enabled. */
export function autoDetectMapping(headers: string[]): HeaderMapping {
  const mapping: HeaderMapping = {};
  const taken = new Set<CanonicalField>();

  headers.forEach((header) => {
    const normalized = normalize(header);
    let matched: CanonicalField | null = null;
    for (const field of CANONICAL_FIELDS) {
      if (taken.has(field)) continue;
      if (ALIASES[field].includes(normalized)) {
        matched = field;
        break;
      }
    }
    mapping[header] = matched;
    if (matched) taken.add(matched);
  });

  return mapping;
}

export function isMappingComplete(mapping: HeaderMapping): boolean {
  return Object.values(mapping).includes('noWaybill');
}

/** Bentuk kanonik nama Kecamatan dipakai di seluruh sistem (input form, data
 *  JMS, pencocokan DP) supaya "Wonotunggal" / "WONOTUNGGAL" / " wonotunggal "
 *  selalu cocok sebagai entitas yang sama. */
export function normalizeKecamatan(value: string): string {
  return value.trim().toUpperCase();
}

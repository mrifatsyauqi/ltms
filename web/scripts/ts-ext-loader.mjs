// Loader Node bawaan (bukan library eksternal) khusus utk `npm test`. Kode
// produksi ditulis dgn konvensi resolusi bundler Next.js (import tanpa
// ekstensi ".ts", alias "@/*" -> "src/*") — Node native tidak paham dua hal
// ini. Loader ini HANYA menambal celah resolusi supaya `node --test` bisa
// meng-import modul produksi APA ADANYA (tanpa mengubah satu baris pun kode
// produksi demi testability) - dipakai access-control.test.ts utk
// menjalankan fungsi asli (getLongTail, submitFeedback, dst) via mock.module
// pada boundary db() saja.
const SRC_ROOT = new URL('../src/', import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  let spec = specifier;
  if (spec.startsWith('@/')) {
    spec = new URL(spec.slice(2), SRC_ROOT).href;
  }
  try {
    return await nextResolve(spec, context);
  } catch (err) {
    // Import relatif tanpa ekstensi (gaya bundler) - coba tambahkan .ts.
    if (!/\.[a-zA-Z0-9]+$/.test(spec)) {
      try {
        return await nextResolve(`${spec}.ts`, context);
      } catch {
        // jatuh ke error asli di bawah
      }
    }
    throw err;
  }
}

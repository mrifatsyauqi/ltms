import * as supa from './supabase/cabang';

export const listCabang = supa.listCabang;
export const createCabang = supa.createCabang;
export const updateCabang = supa.updateCabang;

export type { CabangRow, CreateCabangInput, UpdateCabangInput } from './types';

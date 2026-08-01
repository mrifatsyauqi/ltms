import * as supa from './supabase/drop-points';

export const listDropPoints = supa.listDropPoints;
export const createDropPoint = supa.createDropPoint;
export const updateDropPoint = supa.updateDropPoint;
export const deleteDropPoint = supa.deleteDropPoint;
export const listSupervisedDropPoints = supa.listSupervisedDropPoints;
export const syncSupervisedDropPoints = supa.syncSupervisedDropPoints;

export type { DropPointRow, CreateDropPointInput, UpdateDropPointInput, SupervisedDropPointRow } from './types';

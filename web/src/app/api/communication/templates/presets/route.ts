import { NextResponse } from 'next/server';
import {
  STARTER_PRESETS,
  OFFICIAL_VARIABLES,
  SAMPLE_DUMMY_CONTEXT,
} from '@/services/communication/configuration/template-presets';

export async function GET() {
  return NextResponse.json({
    ok: true,
    presets: STARTER_PRESETS,
    variables: OFFICIAL_VARIABLES,
    dummyContext: SAMPLE_DUMMY_CONTEXT,
  });
}

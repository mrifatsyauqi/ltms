import { NextResponse } from 'next/server';
import { communicationController } from '@/services/communication/communication.controller';

export const dynamic = 'force-dynamic';

/**
 * GET /api/communication/health
 * Endpoint diagnostik untuk memeriksa kesiapan dan status koneksi Feishu Open Platform.
 */
export async function GET() {
  const result = await communicationController.handleHealthCheck();
  return NextResponse.json(result.body, { status: result.status });
}

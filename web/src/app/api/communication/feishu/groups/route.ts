import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { communicationController } from '@/services/communication/communication.controller';
import { unauthenticated } from '@/lib/api-response';

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  const response = await communicationController.handleGetGroups('feishu');
  return NextResponse.json(response.body, { status: response.status });
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  const response = await communicationController.handleSyncGroups('feishu');
  return NextResponse.json(response.body, { status: response.status });
}

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { communicationController } from '@/services/communication/communication.controller';
import { unauthenticated, errorResponse } from '@/lib/api-response';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  try {
    const body = await request.json();
    const response = await communicationController.handleSendMessage(
      body,
      session.user.email
    );

    return NextResponse.json(response.body, { status: response.status });
  } catch (err) {
    return errorResponse(err);
  }
}

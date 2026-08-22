import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getWhatsappContacts, upsertWhatsappContact } from '@/lib/data/supabase/whatsapp';
import { unauthenticated, errorResponse } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  try {
    const { searchParams } = new URL(req.url);
    const requestedDpIds = searchParams.getAll('dp');
    const activeOnly = searchParams.get('activeOnly') === 'true';
    
    // DP Scope Authorization
    const userRole = (session.user as any).role || 'Admin DP';
    const userDpId = (session.user as any).dp_id;

    let allowedDpIds: string[] | undefined = requestedDpIds.length > 0 ? requestedDpIds : undefined;
    
    if (userRole === 'Admin DP' || userRole === 'SPV') {
      if (!userDpId) {
        throw new Error('User does not have an assigned Drop Point');
      }
      
      if (allowedDpIds) {
        allowedDpIds = allowedDpIds.filter(id => id === userDpId);
        if (allowedDpIds.length === 0) {
           return NextResponse.json({ ok: true, data: [] });
        }
      } else {
        allowedDpIds = [userDpId];
      }
    }

    const contacts = await getWhatsappContacts(allowedDpIds, activeOnly);
    return NextResponse.json({ ok: true, data: contacts });
  } catch (error: any) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  try {
    const body = await req.json();
    const { sprinter_id, name, phone_number, drop_point_id, is_active } = body;
    
    if (!sprinter_id || !name || !phone_number || !drop_point_id) {
      return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 });
    }

    // DP Scope Authorization for Upsert
    const userRole = (session.user as any).role || 'Admin DP';
    const userDpId = (session.user as any).dp_id;

    if (userRole === 'Admin DP' || userRole === 'SPV') {
      if (drop_point_id !== userDpId) {
        return NextResponse.json({ ok: false, error: 'Forbidden: Cannot create/update contact for another Drop Point' }, { status: 403 });
      }
    }

    const statusValue = is_active !== undefined ? (is_active ? 'active' : 'inactive') : 'active';
    const isActiveValue = is_active !== undefined ? is_active : true;

    const contact = await upsertWhatsappContact({
      sprinter_id,
      name,
      phone_number,
      drop_point_id,
      status: statusValue,
      is_active: isActiveValue
    } as any);
    
    return NextResponse.json({ ok: true, data: contact });
  } catch (error: any) {
    return errorResponse(error);
  }
}

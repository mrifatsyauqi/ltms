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
    const userDpId = (session.user as any).dropPoint;

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
    const { id, name, phone_number, drop_point_id, is_active } = body;
    
    if (!name || !phone_number || !drop_point_id) {
      return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 });
    }

    // DP Scope Authorization for Upsert
    const userRole = (session.user as any).role || 'Admin DP';
    const userDpId = (session.user as any).dropPoint;

    if (userRole === 'Admin DP' || userRole === 'SPV') {
      if (drop_point_id !== userDpId) {
        return NextResponse.json({ ok: false, error: 'Anda tidak memiliki akses ke kontak pada Drop Point ini.' }, { status: 403 });
      }
    }

    // Duplicate Check using Normalized Name
    const { normalizeContactName } = await import('@/lib/string-utils');
    const normalizedNewName = normalizeContactName(name);
    
    const existingContacts = await getWhatsappContacts([drop_point_id]);
    const duplicate = existingContacts.find(c => 
      normalizeContactName(c.name) === normalizedNewName && c.id !== id
    );

    if (duplicate) {
      return NextResponse.json({ ok: false, error: 'Kontak dengan nama tersebut sudah terdaftar di Drop Point ini.' }, { status: 400 });
    }

    const statusValue = is_active !== undefined ? (is_active ? 'active' : 'inactive') : 'active';
    const isActiveValue = is_active !== undefined ? is_active : true;

    // Use dynamic import for the newly added functions to ensure types are satisfied without full module reload issues
    const db = await import('@/lib/data/supabase/whatsapp');

    let contact;
    if (id) {
      contact = await db.updateWhatsappContact(id, {
        name,
        phone_number,
        drop_point_id,
        status: statusValue,
        is_active: isActiveValue
      });
    } else {
      contact = await db.createWhatsappContact({
        sprinter_id: crypto.randomUUID(), // Dummy UUID to satisfy existing DB constraints, no longer used for mapping
        name,
        phone_number,
        drop_point_id,
        status: statusValue,
        is_active: isActiveValue
      } as any);
    }
    
    return NextResponse.json({ ok: true, data: contact });
  } catch (error: any) {
    console.error('Create contact error:', error);
    return errorResponse(error);
  }
}


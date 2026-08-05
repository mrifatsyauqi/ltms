import { NextRequest, NextResponse } from 'next/server';
import { feishuAuthService } from '@/services/communication/providers/feishu/auth.service';

/**
 * POST /api/communication/mentions/validate
 * Validates whether a given Feishu Open ID is well-formed and can be looked up
 * Body: { open_id: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { open_id } = await request.json();

    if (!open_id || typeof open_id !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Open ID tidak boleh kosong' },
        { status: 400 }
      );
    }

    const trimmed = open_id.trim();

    // Check basic Feishu open ID format (typically starts with ou_ and length >= 10)
    if (!trimmed.startsWith('ou_') && !trimmed.startsWith('on_') && !trimmed.startsWith('cli_')) {
      return NextResponse.json({
        success: true,
        valid: false,
        status: 'invalid_format',
        message: 'Format Open ID tidak valid (biasanya diawali dengan ou_)',
      });
    }

    // Try testing with Feishu Open Platform directory API if token available
    try {
      const token = await feishuAuthService.getTenantAccessToken();
      const res = await fetch(`https://open.feishu.cn/open-apis/contact/v3/users/${trimmed}?user_id_type=open_id`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const json = await res.json();
        if (json.code === 0 && json.data?.user) {
          return NextResponse.json({
            success: true,
            valid: true,
            status: 'valid',
            userInfo: {
              name: json.data.user.name,
              email: json.data.user.email,
              mobile: json.data.user.mobile,
              department: json.data.user.department_ids,
            },
            message: `Valid: ${json.data.user.name}`,
          });
        }
      }
    } catch {
      // If network/token not configured, fallback to format check
    }

    // Format is valid (starts with ou_)
    return NextResponse.json({
      success: true,
      valid: true,
      status: 'valid_format',
      message: 'Format Open ID valid (ou_*)',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Gagal memvalidasi Open ID' },
      { status: 500 }
    );
  }
}

'use client';

import React from 'react';
import {
  Package,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  MapPin,
  Truck,
  ExternalLink,
  Bot,
  User,
  AtSign,
  Image as ImageIcon,
} from 'lucide-react';
import type {
  VisualCardBlocksConfig,
  TemplateVariablesContext,
} from '@/services/communication/configuration/template.types';
import { MessageTemplateEngine } from '@/services/communication/configuration/message-template.engine';
import type { MentionMappingRecord } from '@/lib/data/supabase/mention-mapping';

interface FeishuCardPreviewProps {
  blocksConfig: VisualCardBlocksConfig;
  variables?: TemplateVariablesContext | Record<string, any>;
  imagePreviewUrl?: string | null;
  mentionMap?: Map<string, MentionMappingRecord[]> | Record<string, any>;
  className?: string;
}

export function FeishuCardPreview({
  blocksConfig,
  variables = {},
  imagePreviewUrl,
  mentionMap,
  className = '',
}: FeishuCardPreviewProps) {
  const ctx = MessageTemplateEngine.normalizeContext(variables);

  // Header Data
  const rawTitle = blocksConfig.header?.title || blocksConfig.title || 'LTMS | Monitoring INC';
  const title = MessageTemplateEngine.render(rawTitle, ctx);
  const rawSubtitle = blocksConfig.header?.subtitle || '';
  const subtitle = rawSubtitle ? MessageTemplateEngine.render(rawSubtitle, ctx) : '';

  // Theme styling
  const themeColors = {
    red: {
      headerBg: 'bg-gradient-to-r from-[#E2231A] to-[#B81912]',
      border: 'border-red-200',
      badgeBg: 'bg-red-50 text-[#E2231A]',
      buttonBg: 'bg-[#E2231A] hover:bg-[#B81912] text-white',
    },
    dark: {
      headerBg: 'bg-gradient-to-r from-slate-900 to-slate-800',
      border: 'border-slate-300',
      badgeBg: 'bg-slate-100 text-slate-800',
      buttonBg: 'bg-slate-900 hover:bg-slate-800 text-white',
    },
    blue: {
      headerBg: 'bg-gradient-to-r from-blue-600 to-blue-700',
      border: 'border-blue-200',
      badgeBg: 'bg-blue-50 text-blue-700',
      buttonBg: 'bg-blue-600 hover:bg-blue-700 text-white',
    },
    green: {
      headerBg: 'bg-gradient-to-r from-emerald-600 to-emerald-700',
      border: 'border-emerald-200',
      badgeBg: 'bg-emerald-50 text-emerald-700',
      buttonBg: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    },
  };

  const currentTheme = themeColors[blocksConfig.theme || 'red'] || themeColors.red;

  // Sub Header Info
  const showPickup = blocksConfig.header?.showPickupDp ?? true;
  const showTarget = blocksConfig.header?.showTargetCity ?? true;
  const showUpdate = blocksConfig.header?.showUpdate ?? true;

  const pickupDp = blocksConfig.header?.pickupDpValue
    ? MessageTemplateEngine.render(blocksConfig.header.pickupDpValue, ctx)
    : (ctx.pickup_dp !== '-' ? ctx.pickup_dp : ctx.drop_point);

  const targetCity = blocksConfig.header?.targetCityValue
    ? MessageTemplateEngine.render(blocksConfig.header.targetCityValue, ctx)
    : (ctx.target_city !== '-' ? ctx.target_city : ctx.city);

  const generateTime = blocksConfig.header?.updateValue
    ? MessageTemplateEngine.render(blocksConfig.header.updateValue, ctx)
    : ctx.generated_at;

  // Parse Subdistricts Assignment
  const subdistrictItems: Array<{ name: string; count: number | string; pic?: string; openId?: string }> = [];
  if (Array.isArray(variables.subdistricts)) {
    variables.subdistricts.forEach((item: any) => {
      if (typeof item === 'object' && item.name) {
        subdistrictItems.push({
          name: String(item.name).toUpperCase(),
          count: item.count || 0,
          pic: item.picName,
          openId: item.openId,
        });
      }
    });
  } else if (ctx.destination_subdistricts && ctx.destination_subdistricts !== '-') {
    const lines = ctx.destination_subdistricts.split('\n').filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const match = line.match(/^([^:\(\d]+)(?::|\(|\s+-\s+)?\s*(\d+)?/);
      if (match) {
        const name = match[1].trim().replace(/^📍\s*/, '').toUpperCase();
        const count = match[2] ? `${match[2]} AWB` : (lines[i + 1]?.includes('AWB') ? lines[++i].trim() : 'Perlu Follow Up');
        subdistrictItems.push({ name, count });
      } else {
        subdistrictItems.push({ name: line.toUpperCase(), count: 'Perlu Follow Up' });
      }
    }
  }

  // Fallback demo subdistricts jika kosong saat preview builder
  if (subdistrictItems.length === 0 && blocksConfig.subdistricts?.show) {
    subdistrictItems.push(
      { name: 'BATANG', count: '10 AWB', pic: 'Agus' },
      { name: 'WARUNGASEM', count: '8 AWB', pic: 'Dimas' },
      { name: 'LIMPUNG', count: '6 AWB', pic: 'Rian' },
      { name: 'BANDAR', count: '5 AWB', pic: 'Arif' }
    );
  }

  // Parse Kurir Assignment
  const kurirItems: Array<{ name: string; count: number | string; pic?: string; openId?: string }> = [];
  if (Array.isArray(variables.kurirList)) {
    variables.kurirList.forEach((item: any) => {
      if (typeof item === 'object' && item.name) {
        kurirItems.push({
          name: String(item.name),
          count: item.count || 0,
          pic: item.picName || item.name,
          openId: item.openId,
        });
      }
    });
  } else if (blocksConfig.kurirFollowUp?.show) {
    kurirItems.push(
      { name: 'Andi Setiawan', count: '12 Paket', pic: 'Andi' },
      { name: 'Rudi Hermawan', count: '8 Paket', pic: 'Rudi' },
      { name: 'Bambang Wijaya', count: '6 Paket', pic: 'Bambang' }
    );
  }

  return (
    <div className={`bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden max-w-lg mx-auto ${className}`}>
      {/* 1. Header Banner */}
      <div className={`${currentTheme.headerBg} p-4 sm:p-5 text-white`}>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
            <Bot className="w-3.5 h-3.5 text-white" />
          </div>
          <h3 className="text-sm sm:text-base font-bold tracking-tight">{title}</h3>
        </div>
        {subtitle && <p className="text-xs text-white/85 font-medium pl-8">{subtitle}</p>}
      </div>

      {/* Card Content Elements */}
      <div className="p-4 sm:p-5 space-y-4">
        {/* 2. Sub Header Information Fields */}
        {(showPickup || showTarget || showUpdate) && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
            {showPickup && pickupDp && pickupDp !== '-' && (
              <div>
                <span className="text-[10px] text-slate-500 font-semibold block uppercase">
                  {blocksConfig.header?.pickupDpLabel || 'Pickup DP'}
                </span>
                <span className="font-bold text-slate-800">{pickupDp}</span>
              </div>
            )}
            {showTarget && targetCity && targetCity !== '-' && (
              <div>
                <span className="text-[10px] text-slate-500 font-semibold block uppercase">
                  {blocksConfig.header?.targetCityLabel || 'Kota Tujuan'}
                </span>
                <span className="font-bold text-slate-800">{targetCity}</span>
              </div>
            )}
            {showUpdate && generateTime && (
              <div className="col-span-2 sm:col-span-1">
                <span className="text-[10px] text-slate-500 font-semibold block uppercase">
                  {blocksConfig.header?.updateLabel || 'Generate'}
                </span>
                <span className="font-medium text-slate-700 text-[11px]">{generateTime}</span>
              </div>
            )}
          </div>
        )}

        {/* 3. Last Scan Block (Monitoring Delivery) */}
        {blocksConfig.lastScan?.show && (
          <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-blue-900">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>{blocksConfig.lastScan.title || 'Last Scan Activity'}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div>
                <span className="text-slate-500 block text-[10px]">{blocksConfig.lastScan.scanTimeLabel || 'Waktu'}</span>
                <span className="font-semibold text-slate-800">{ctx.last_scan_time || '08:21 WIB'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">{blocksConfig.lastScan.awbLabel || 'AWB'}</span>
                <span className="font-semibold font-mono text-slate-800">{ctx.last_scan_awb || 'JT1234567890'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">{blocksConfig.lastScan.statusLabel || 'Status'}</span>
                <span className="font-semibold text-emerald-700">{ctx.last_scan_status || 'Delivery'}</span>
              </div>
            </div>
          </div>
        )}

        {/* 4. KPI Summary Grid */}
        {blocksConfig.kpiGrid && (
          <div className="space-y-2">
            {blocksConfig.kpiGrid.title && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <TrendingUp className="w-3.5 h-3.5 text-slate-600" />
                <span>{blocksConfig.kpiGrid.title}</span>
              </div>
            )}
            <div
              className={`grid gap-2 ${
                blocksConfig.kpiGrid.layout === 'horizontal_5'
                  ? 'grid-cols-2 sm:grid-cols-5'
                  : blocksConfig.kpiGrid.layout === '4_column'
                  ? 'grid-cols-2 sm:grid-cols-4'
                  : 'grid-cols-2'
              }`}
            >
              {(blocksConfig.kpiGrid.items || []).map((item, idx) => {
                const val = MessageTemplateEngine.render(item.valueTemplate, ctx);
                const isAlert = item.color === 'red';
                const isSuccess = item.color === 'green';

                return (
                  <div
                    key={item.id || idx}
                    className={`p-2.5 rounded-xl border text-center ${
                      isAlert
                        ? 'bg-red-50/60 border-red-200'
                        : isSuccess
                        ? 'bg-emerald-50/60 border-emerald-200'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <span className="text-[10px] font-semibold text-slate-600 block line-clamp-1 mb-0.5">
                      {item.label}
                    </span>
                    <span
                      className={`text-sm font-extrabold ${
                        isAlert ? 'text-[#E2231A]' : isSuccess ? 'text-emerald-600' : 'text-slate-900'
                      }`}
                    >
                      {val || '0'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 5. OPERATIONAL ASSIGNMENT: 📍 Kecamatan Tujuan (INC) */}
        {blocksConfig.subdistricts?.show && subdistrictItems.length > 0 && (
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <MapPin className="w-3.5 h-3.5 text-[#E2231A]" />
                <span>{blocksConfig.subdistricts.title || '📍 Kecamatan Tujuan'}</span>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-[#E2231A]">
                Assignment Reminder
              </span>
            </div>

            <div className="space-y-2">
              {subdistrictItems
                .slice(
                  0,
                  blocksConfig.subdistricts.maxItems === '10'
                    ? 10
                    : blocksConfig.subdistricts.maxItems === '15'
                    ? 15
                    : blocksConfig.subdistricts.maxItems === 'all'
                    ? 999
                    : 5
                )
                .map((item, idx) => {
                  const kecKey = item.name.toUpperCase();
                  let mappings: MentionMappingRecord[] = [];
                  if (mentionMap instanceof Map) {
                    mappings = mentionMap.get(kecKey) || [];
                  } else if (mentionMap && typeof mentionMap === 'object') {
                    mappings = mentionMap[kecKey] || [];
                  }

                  const picName =
                    mappings.length > 0
                      ? mappings.map((m) => m.pic_name).join(', ')
                      : item.pic || `Admin DP ${item.name}`;

                  const hasOpenId = mappings.some((m) => !!m.feishu_open_id) || !!item.openId;

                  return (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5">
                        <span className="font-bold text-slate-900 block text-xs">{item.name}</span>
                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                          <Package className="w-3 h-3 text-slate-400" />
                          <span className="font-semibold text-slate-700">{item.count}</span>
                        </div>
                      </div>

                      {blocksConfig.subdistricts?.showMention !== false && (
                        <div
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                            hasOpenId
                              ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm'
                              : 'bg-slate-100 border-slate-200 text-slate-700'
                          }`}
                        >
                          <AtSign className="w-3 h-3 text-blue-600" />
                          <span>{picName}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* 6. OPERATIONAL ASSIGNMENT: 🛵 Kurir Perlu Follow Up (Delivery) */}
        {blocksConfig.kurirFollowUp?.show && kurirItems.length > 0 && (
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Truck className="w-3.5 h-3.5 text-blue-600" />
                <span>{blocksConfig.kurirFollowUp.title || '🛵 Kurir Perlu Follow Up'}</span>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                Kurir Assignment
              </span>
            </div>

            <div className="space-y-2">
              {kurirItems
                .slice(
                  0,
                  blocksConfig.kurirFollowUp.maxItems === '10'
                    ? 10
                    : blocksConfig.kurirFollowUp.maxItems === '15'
                    ? 15
                    : blocksConfig.kurirFollowUp.maxItems === 'all'
                    ? 999
                    : 5
                )
                .map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <span className="font-bold text-slate-900 block text-xs">{item.name}</span>
                      <div className="flex items-center gap-1 text-[11px] text-slate-500">
                        <Package className="w-3 h-3 text-slate-400" />
                        <span className="font-semibold text-slate-700">{item.count}</span>
                      </div>
                    </div>

                    <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-blue-50 border border-blue-200 text-blue-700 shadow-sm">
                      <AtSign className="w-3 h-3 text-blue-600" />
                      <span>{item.name}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* 7. Image Attachment Mockup */}
        {blocksConfig.screenshot?.show && (
          <div className="space-y-1.5 pt-1 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-800 block">
              {blocksConfig.screenshot.title || '🖼 Lampiran Monitoring'}
            </span>
            {imagePreviewUrl ? (
              <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-950">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreviewUrl} alt="Preview Attachment" className="w-full h-auto object-cover max-h-56" />
              </div>
            ) : (
              <div className="h-28 rounded-xl bg-slate-100 border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 gap-1 text-xs">
                <ImageIcon className="w-6 h-6 text-slate-300" />
                <span>Gambar Hasil Render HD 1200×900</span>
              </div>
            )}
          </div>
        )}

        {/* 8. Action Button */}
        {blocksConfig.actionButton?.enabled && (
          <div className="pt-1">
            <button
              type="button"
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all ${currentTheme.buttonBg}`}
            >
              <span>{blocksConfig.actionButton.label || '🚀 Buka LTMS Dashboard'}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 9. Footer Note */}
        {blocksConfig.footer?.show && (
          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 text-center space-y-0.5">
            <span className="font-semibold text-slate-500 block">
              {blocksConfig.footer.title || 'Generated Automatically by LTMS'}
            </span>
            <span>{blocksConfig.footer.description || 'Long Tail Monitoring System • Real-Time Operational Reminder'}</span>
          </div>
        )}
      </div>
    </div>
  );
}

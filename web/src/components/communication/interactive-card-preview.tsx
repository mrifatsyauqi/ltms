'use client';

import React from 'react';
import { Bot, AtSign, ExternalLink, Image as ImageIcon } from 'lucide-react';

export interface InteractiveCardPreviewProps {
  /** Compiled Feishu Interactive Card 2.0 JSON produced by CardCompilerService. Never raw blocks_config. */
  cardJson: Record<string, any> | null | undefined;
  /** Optional local image preview (e.g. base64 data URL) shown in place of an uploaded img_key. */
  imagePreviewUrl?: string | null;
  loading?: boolean;
  className?: string;
}

const THEME_STYLES: Record<string, { headerBg: string; buttonBg: string }> = {
  red: {
    headerBg: 'bg-gradient-to-r from-[#E2231A] to-[#B81912]',
    buttonBg: 'bg-[#E2231A] hover:bg-[#B81912] text-white',
  },
  grey: {
    headerBg: 'bg-gradient-to-r from-slate-900 to-slate-800',
    buttonBg: 'bg-slate-900 hover:bg-slate-800 text-white',
  },
  blue: {
    headerBg: 'bg-gradient-to-r from-blue-600 to-blue-700',
    buttonBg: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
  wathet: {
    headerBg: 'bg-gradient-to-r from-sky-500 to-sky-600',
    buttonBg: 'bg-sky-500 hover:bg-sky-600 text-white',
  },
  turquoise: {
    headerBg: 'bg-gradient-to-r from-teal-500 to-teal-600',
    buttonBg: 'bg-teal-500 hover:bg-teal-600 text-white',
  },
  green: {
    headerBg: 'bg-gradient-to-r from-emerald-600 to-emerald-700',
    buttonBg: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  },
  yellow: {
    headerBg: 'bg-gradient-to-r from-amber-500 to-amber-600',
    buttonBg: 'bg-amber-500 hover:bg-amber-600 text-white',
  },
  orange: {
    headerBg: 'bg-gradient-to-r from-orange-500 to-orange-600',
    buttonBg: 'bg-orange-500 hover:bg-orange-600 text-white',
  },
  carmine: {
    headerBg: 'bg-gradient-to-r from-rose-600 to-rose-700',
    buttonBg: 'bg-rose-600 hover:bg-rose-700 text-white',
  },
  violet: {
    headerBg: 'bg-gradient-to-r from-violet-600 to-violet-700',
    buttonBg: 'bg-violet-600 hover:bg-violet-700 text-white',
  },
  purple: {
    headerBg: 'bg-gradient-to-r from-purple-600 to-purple-700',
    buttonBg: 'bg-purple-600 hover:bg-purple-700 text-white',
  },
  indigo: {
    headerBg: 'bg-gradient-to-r from-indigo-600 to-indigo-700',
    buttonBg: 'bg-indigo-600 hover:bg-indigo-700 text-white',
  },
};

/** Splits `text` on `regex` and lets `transform` turn each match into a React node, preserving surrounding plain text. */
function applyInlinePattern(
  segments: Array<string | React.ReactNode>,
  regex: RegExp,
  transform: (match: RegExpMatchArray, key: string) => React.ReactNode
): Array<string | React.ReactNode> {
  const next: Array<string | React.ReactNode> = [];
  segments.forEach((seg, segIdx) => {
    if (typeof seg !== 'string') {
      next.push(seg);
      return;
    }
    let lastIndex = 0;
    let matchIdx = 0;
    const re = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`);
    let m: RegExpExecArray | null;
    while ((m = re.exec(seg))) {
      if (m.index > lastIndex) next.push(seg.slice(lastIndex, m.index));
      next.push(transform(m, `p-${segIdx}-${matchIdx++}`));
      lastIndex = m.index + m[0].length;
    }
    if (lastIndex < seg.length) next.push(seg.slice(lastIndex));
  });
  return next;
}

/** Renders one line of Feishu lark_md content: <at>, <font color>, and **bold** markers. */
function renderLarkMdLine(line: string, key: string): React.ReactNode {
  let segments: Array<string | React.ReactNode> = [line];

  segments = applyInlinePattern(segments, /<at id="([^"]+)">([^<]*)<\/at>/, (m, k) => (
    <span
      key={k}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 font-semibold text-[11px] mx-0.5 align-middle"
    >
      <AtSign className="w-2.5 h-2.5" />
      {m[2]}
    </span>
  ));

  segments = applyInlinePattern(segments, /<font color='(\w+)'>(.*?)<\/font>/, (m, k) => {
    const color = m[1] === 'red' ? 'text-[#E2231A]' : m[1] === 'green' ? 'text-emerald-600' : 'text-slate-900';
    return (
      <span key={k} className={`font-extrabold ${color}`}>
        {m[2].replace(/\*\*/g, '')}
      </span>
    );
  });

  segments = applyInlinePattern(segments, /\*\*(.*?)\*\*/, (m, k) => <strong key={k}>{m[1]}</strong>);

  return (
    <React.Fragment key={key}>
      {segments.map((s, i) => (typeof s === 'string' ? <React.Fragment key={`${key}-t-${i}`}>{s}</React.Fragment> : s))}
    </React.Fragment>
  );
}

function LarkMdBlock({ content }: { content: string }) {
  const lines = (content || '').split('\n');
  return (
    <div className="space-y-1 leading-relaxed">
      {lines.map((line, i) => {
        if (/^━{5,}$/.test(line.trim())) {
          return <hr key={`hr-${i}`} className="border-slate-200 my-2" />;
        }
        if (line.trim() === '') return <div key={`sp-${i}`} className="h-1" />;
        return <p key={`l-${i}`}>{renderLarkMdLine(line, `l-${i}`)}</p>;
      })}
    </div>
  );
}

/**
 * ONE preview component shared identically by Card Builder Preview, Share
 * Dialog Preview, and History Preview. It receives already-compiled Feishu
 * card JSON (from CardCompilerService via the /card-templates/preview
 * endpoint or a persisted communication_logs.card_json row) and renders it —
 * it never receives raw blocks_config and never re-implements compilation.
 */
export function InteractiveCardPreview({
  cardJson,
  imagePreviewUrl,
  loading,
  className = '',
}: InteractiveCardPreviewProps) {
  if (loading) {
    return (
      <div className={`bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden max-w-lg mx-auto p-10 text-center text-slate-400 text-xs ${className}`}>
        Mengompilasi kartu…
      </div>
    );
  }

  if (!cardJson) {
    return (
      <div className={`bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden max-w-lg mx-auto p-10 text-center text-slate-400 text-xs ${className}`}>
        Tidak ada data kartu untuk ditampilkan.
      </div>
    );
  }

  const theme = cardJson.header?.template || 'red';
  const style = THEME_STYLES[theme] || THEME_STYLES.red;
  const title = cardJson.header?.title?.content || '';
  const subtitle = cardJson.header?.subtitle?.content || '';
  const elements: any[] = Array.isArray(cardJson.elements) ? cardJson.elements : [];

  return (
    <div className={`bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden max-w-lg mx-auto ${className}`}>
      {/* Header Banner */}
      <div className={`${style.headerBg} p-4 sm:p-5 text-white`}>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
            <Bot className="w-3.5 h-3.5 text-white" />
          </div>
          <h3 className="text-sm sm:text-base font-bold tracking-tight">{title}</h3>
        </div>
        {subtitle && <p className="text-xs text-white/85 font-medium pl-8">{subtitle}</p>}
      </div>

      {/* Elements */}
      <div className="p-4 sm:p-5 space-y-3 text-xs">
        {elements.map((el, idx) => {
          const key = `el-${idx}`;

          if (el.tag === 'hr') {
            return <hr key={key} className="border-slate-100" />;
          }

          if (el.tag === 'div' && Array.isArray(el.fields)) {
            return (
              <div
                key={key}
                className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-100"
              >
                {el.fields.map((f: any, fi: number) => (
                  <div key={`${key}-f-${fi}`}>
                    <LarkMdBlock content={f.text?.content || ''} />
                  </div>
                ))}
              </div>
            );
          }

          if (el.tag === 'div' && el.text?.content) {
            return (
              <div key={key}>
                <LarkMdBlock content={el.text.content} />
              </div>
            );
          }

          if (el.tag === 'note') {
            return (
              <div key={key} className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 text-center space-y-0.5">
                {(el.elements || []).map((e: any, ei: number) => (
                  <span key={`${key}-n-${ei}`} className="block">
                    {e.content}
                  </span>
                ))}
              </div>
            );
          }

          if (el.tag === 'img') {
            return (
              <div key={key} className="rounded-xl overflow-hidden border border-slate-200 bg-slate-950">
                {imagePreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imagePreviewUrl}
                    alt={el.alt?.content || 'Lampiran'}
                    className="w-full h-auto object-cover max-h-56"
                  />
                ) : (
                  <div className="h-28 flex flex-col items-center justify-center text-slate-400 gap-1">
                    <ImageIcon className="w-6 h-6 text-slate-500" />
                    <span className="text-[10px] text-slate-500">img_key: {el.img_key || '-'}</span>
                  </div>
                )}
              </div>
            );
          }

          if (el.tag === 'action') {
            return (
              <div key={key} className="pt-1 space-y-2">
                {(el.actions || []).map((a: any, ai: number) => (
                  <a
                    key={`${key}-a-${ai}`}
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all ${style.buttonBg}`}
                  >
                    <span>{a.text?.content}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ))}
              </div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}

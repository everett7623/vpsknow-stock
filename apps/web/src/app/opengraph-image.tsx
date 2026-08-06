import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/* OG ImageResponse requires raw <img> with data URLs */
/* eslint-disable @next/next/no-img-element */

export const alt = 'VPSKnow Stock — Restock Alerts, Live Stock, Offers';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpenGraphImage(): Promise<ImageResponse> {
  const markBuffer = await readFile(join(process.cwd(), 'public/brand/mark.png'));
  const markSrc = `data:image/png;base64,${markBuffer.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #07070c 0%, #0a0a0f 45%, #12122a 100%)',
          color: '#ffffff',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(34,211,238,0.16), transparent 42%), radial-gradient(circle at 85% 30%, rgba(139,92,246,0.18), transparent 40%), radial-gradient(circle at 70% 80%, rgba(16,185,129,0.12), transparent 35%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: '-40px',
            bottom: '-60px',
            width: '520px',
            height: '520px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(34,211,238,0.12), transparent 65%)',
          }}
        />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '72px 64px',
            width: '62%',
            gap: '22px',
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
            <img src={markSrc} width={88} height={88} alt="" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: '-0.03em', color: '#ffffff', lineHeight: 1 }}>
                VPSKnow Stock
              </div>
              <div
                style={{
                  fontSize: 18,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: '#d1d5db',
                }}
              >
                Restock Alerts · Live Stock · Offers
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginTop: '8px',
              padding: '10px 18px',
              borderRadius: '999px',
              border: '1px solid rgba(52,211,153,0.45)',
              background: 'rgba(16,185,129,0.12)',
              color: '#ffffff',
              fontSize: 22,
            }}
          >
            stock.vpsknow.com
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            right: '56px',
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '360px',
            height: '360px',
            borderRadius: '40px',
            background: 'linear-gradient(160deg, rgba(18,18,32,0.9), rgba(10,10,20,0.55))',
            border: '1px solid rgba(148,163,184,0.18)',
            boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
          }}
        >
          <img src={markSrc} width={260} height={260} alt="" />
        </div>
      </div>
    ),
    size,
  );
}

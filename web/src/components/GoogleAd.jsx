import React, { useEffect, useRef } from 'react';

const GoogleAd = ({ slot, style = { display: 'block' }, format = 'auto', responsive = 'true' }) => {
  const adRef = useRef(null);
  const hasPushed = useRef(false);

  const isDev = process.env.NODE_ENV !== 'production';
  const publisherId = 'ca-pub-8696949351170656';
  const adSlot = slot;

  useEffect(() => {
    if (isDev || !adSlot || hasPushed.current || !adRef.current) return;

    const pushAd = () => {
      try {
        if (adRef.current && !adRef.current.hasAttribute('data-adsbygoogle-status') && !hasPushed.current) {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
          hasPushed.current = true;
        }
      } catch (err) {
        const errorMessage = String(err);
        if (errorMessage.includes('already have ads')) {
          hasPushed.current = true;
        } else if (errorMessage.includes('availableWidth=0')) {
          console.warn('AdSense push skipped: Container has 0 width.');
        } else {
          console.error('AdSense push error:', err);
        }
      }
    };

    if (window.adsbygoogle) {
      pushAd();
      return;
    }

    const existingScript = document.querySelector('script[src*="adsbygoogle.js"]');
    if (existingScript) {
      existingScript.addEventListener('load', pushAd);
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisherId}`;
    script.crossOrigin = 'anonymous';
    script.onload = pushAd;
    document.head.appendChild(script);
  }, [isDev, adSlot, publisherId]);

  if (isDev) {
    return (
      <div style={{ ...style, backgroundColor: '#f1f5f9', border: '1px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '14px' }}>
        AdSense Placeholder
      </div>
    );
  }

  return (
    <ins
      ref={adRef}
      className="adsbygoogle"
      style={style}
      data-ad-client={publisherId}
      data-ad-slot={adSlot}
      data-ad-format={format}
      data-full-width-responsive={responsive}
    />
  );
};

export default GoogleAd;
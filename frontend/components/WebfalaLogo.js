/**
 * Official Webfala Digital Skills For All Initiative branding.
 * Logo file: /public/images/webfala-logo.png
 */
export default function WebfalaLogo({ variant = 'default' }) {
  const isCompact = variant === 'compact';
  return (
    <div className={`webfala-brand ${isCompact ? 'webfala-brand--compact' : ''}`}>
      <img
        src="/images/webfala-logo.png"
        alt="Webfala Digital Skills For All Initiative"
        className="webfala-brand__img"
        width={isCompact ? 140 : 280}
        height={isCompact ? 48 : 96}
        style={{ width: 'auto', height: isCompact ? 44 : 88, maxWidth: '100%' }}
      />
    </div>
  );
}

import Image from 'next/image';

const sizeMap = {
  sm: { mark: 28, text: 'text-sm', gap: 'gap-2' },
  md: { mark: 32, text: 'text-base', gap: 'gap-2.5' },
  lg: { mark: 56, text: 'text-3xl', gap: 'gap-3' },
} as const;

export function BrandLogo({ size = 'md' }: { size?: keyof typeof sizeMap }): React.JSX.Element {
  const config = sizeMap[size];

  return (
    <span className={`inline-flex items-center ${config.gap}`}>
      <Image
        src="/brand/mark.png"
        alt=""
        width={config.mark}
        height={config.mark}
        className="shrink-0 object-contain"
        priority={size !== 'lg'}
      />
      <span className={`leading-none tracking-wide ${config.text}`}>
        {/* Dark: pure white VPSKnow; Light: slate gray — Stock stays emerald to differ from main site */}
        <span className="font-semibold text-slate-600 dark:text-white">VPSKnow</span>
        <span className="ml-1.5 font-semibold text-stock">Stock</span>
      </span>
    </span>
  );
}

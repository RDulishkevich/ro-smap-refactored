import { useTh } from '../state/ThemeContext';
import markOnDark from '../../../../assets/polevka-mark-dark.png';
import markOnLight from '../../../../assets/polevka-mark-light.png';

/** Silhouette vole (not the circular favicon) for compact chrome. */
export default function BrandMark({ className }: { className?: string }) {
  const { isDark } = useTh();
  return (
    <div className={`relative overflow-hidden ${className || 'size-full'}`}>
      <img
        src={isDark ? markOnDark : markOnLight}
        alt=""
        className="absolute inset-[-22%] w-[144%] h-[144%] object-contain pointer-events-none"
      />
    </div>
  );
}

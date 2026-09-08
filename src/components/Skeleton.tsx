import React from 'react';

export type SkeletonVariant = 'rect' | 'circle' | 'text';

interface SkeletonProps {
  /** The shape of the skeleton. */
  variant?: SkeletonVariant;
  /** Width of the skeleton. Defaults to '100%'. */
  width?: string | number;
  /** Height of the skeleton. Defaults to '1rem'. */
  height?: string | number;
  /** Additional CSS classes. */
  className?: string;
  /** Additional inline styles. */
  style?: React.CSSProperties;
}

/**
 * A component that displays a loading skeleton with a shimmer animation.
 *
 * @example
 * <Skeleton variant="circle" width={40} height={40} />
 * <Skeleton variant="rect" width="100%" height={20} />
 * <Skeleton variant="text" width="80%" height={12} />
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'rect',
  width = '100%',
  height = '1rem',
  className = '',
  style = {},
}) => {
  const borderRadius = variant === 'circle' ? '50%' : '4px';

  const baseStyle: React.CSSProperties = {
    width,
    height,
    borderRadius,
    backgroundColor: '#e5e7eb', // Tailwind gray-200
    display: 'inline-block',
    position: 'relative',
    overflow: 'hidden',
    ...style,
  };

  return (
    <div className={`skeleton-container ${className}`} style={baseStyle}>
      <div className="skeleton-shimmer" />
    </div>
  );
};

// Injecting styles for the shimmer animation
if (typeof document !== 'undefined') {
  const styleId = 'skeleton-shimmer-styles';
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = `
      .skeleton-shimmer {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(
          90deg,
          rgba(255, 255, 255, 0) 0%,
          rgba(255, 255, 255, 0.5) 50%,
          rgba(255, 255, 255, 0) 100%
        );
        animation: skeleton-shimmer 1.5s infinite;
        transform: translateX(-100%);
      }
      @keyframes skeleton-shimmer {
        100% {
          transform: translateX(100%);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .skeleton-shimmer {
          animation: none;
          display: none;
        }
      }
    `;
    document.head.appendChild(styleEl);
  }
}

export default Skeleton;

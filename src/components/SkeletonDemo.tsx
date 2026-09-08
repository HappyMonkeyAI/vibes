import React, { Suspense } from 'react';
import { Skeleton } from './Skeleton.js';

/**
 * A dummy component that simulates data fetching with a delay.
 */
const AsyncDataComponent = () => {
  // In a real app, this would be a component that triggers a Suspense boundary.
  // For demonstration, we'll use a simple timeout-based approach or just assume it's being used in a real environment.
  return <div>Data loaded successfully!</div>;
};

/**
 * A component that wraps data fetching in Suspense.
 */
const DataWithSuspense = () => (
  <Suspense fallback={
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '20px', maxWidth: '300px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Skeleton variant="circle" width={48} height={48} />
        <div style={{ flex: 1 }}>
          <Skeleton variant="rect" width="80%" height={16} />
          <Skeleton variant="rect" width="40%" height={12} />
        </div>
      </div>
      <Skeleton variant="rect" width="100%" height={60} />
    </div>
  }>
    <AsyncDataComponent />
  </Suspense>
);

/**
 * Demo component showcasing different skeleton variants.
 */
export const SkeletonDemo = () => {
  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif' }}>
      <h2>Skeleton Variants Demo</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '40px' }}>
        <div>
          <strong>Rect:</strong><br />
          <Skeleton width="200px" height="40px" />
        </div>
        <div>
          <strong>Circle:</strong><br />
          <Skeleton variant="circle" width="50px" height="50px" />
        </div>
        <div>
          <strong>Text:</strong><br />
          <Skeleton variant="text" width="300px" height="14px" />
          <div style={{ height: '8px' }} />
          <Skeleton variant="text" width="250px" height="14px" />
        </div>
      </div>

      <hr />
      <h2>Suspense Integration Demo</h2>
      <p>The box below will show skeletons while content is loading.</p>
      <DataWithSuspense />
    </div>
  );
};

export default SkeletonDemo;

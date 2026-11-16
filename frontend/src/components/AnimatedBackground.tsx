/**
 * Flat background for the authentication screens (login, register, forgot password):
 * neutral surface with a faint dot grid. Since 0.9 it no longer animates gradient blobs.
 */
import React from 'react';

const AnimatedBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 -z-10 bg-gray-50 dark:bg-gray-950" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(theme(colors.gray.300)_1px,transparent_1px)] [background-size:20px_20px] opacity-60 dark:bg-[radial-gradient(theme(colors.gray.800)_1px,transparent_1px)]" />
    </div>
  );
};

export default AnimatedBackground;

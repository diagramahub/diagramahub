
/**
 * Natural tumbleweed icon — a dried desert plant rolling across the screen.
 *
 * Built with curved SVG paths radiating from the center to mimic the
 * branch-like structure of a real tumbleweed (Salsola tragus).
 * Pure CSS animation: rotates while bobbing gently.
 */
export default function TumbleweedIcon() {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
      aria-hidden="true"
    >
      <style>{`
        @keyframes tw-roll {
          0%   { transform: rotate(0deg) translateY(0px); }
          20%  { transform: rotate(72deg) translateY(-5px); }
          40%  { transform: rotate(144deg) translateY(-2px); }
          60%  { transform: rotate(216deg) translateY(-7px); }
          80%  { transform: rotate(288deg) translateY(-3px); }
          100% { transform: rotate(360deg) translateY(0px); }
        }
        @keyframes tw-drift {
          0%   { transform: translateX(0px); }
          50%  { transform: translateX(5px); }
          100% { transform: translateX(0px); }
        }
        .tw-plant {
          animation: tw-roll 10s linear infinite;
          transform-origin: 60px 60px;
        }
        .tw-outer {
          animation: tw-drift 3.5s ease-in-out infinite;
        }
      `}</style>

      <g className="tw-outer">
        <g className="tw-plant">
          {/* Curved branches radiating from center — each is a quadratic bezier */}
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle, i) => {
            const rad = (angle * Math.PI) / 180;
            const length = 25 + (i % 3) * 10; // varied lengths: 25, 30, 35
            const midX = 60 + (length * 0.55) * Math.cos(rad + 0.25);
            const midY = 60 + (length * 0.55) * Math.sin(rad + 0.25);
            const endX = 60 + length * Math.cos(rad);
            const endY = 60 + length * Math.sin(rad);
            const thickness = 1.2 + (i % 3) * 0.3;
            return (
              <path
                key={`b-${angle}`}
                d={`M60 60 Q${midX} ${midY} ${endX} ${endY}`}
                stroke="currentColor"
                strokeWidth={thickness}
                strokeLinecap="round"
                className="text-amber-700/40 dark:text-amber-500/25"
              />
            );
          })}

          {/* Secondary thinner branches crossing between main ones */}
          {[15, 45, 75, 105, 135, 165, 195, 225, 255, 285, 315, 345].map((angle) => {
            const rad = (angle * Math.PI) / 180;
            const length = 20;
            const midX = 60 + (length * 0.5) * Math.cos(rad - 0.3);
            const midY = 60 + (length * 0.5) * Math.sin(rad - 0.3);
            const endX = 60 + length * Math.cos(rad);
            const endY = 60 + length * Math.sin(rad);
            return (
              <path
                key={`s-${angle}`}
                d={`M60 60 Q${midX} ${midY} ${endX} ${endY}`}
                stroke="currentColor"
                strokeWidth={0.9}
                strokeLinecap="round"
                className="text-amber-600/30 dark:text-amber-400/20"
              />
            );
          })}

          {/* Tiny seed pods / knots at branch tips */}
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle) => {
            const rad = (angle * Math.PI) / 180;
            const length = 30;
            const cx = 60 + length * Math.cos(rad);
            const cy = 60 + length * Math.sin(rad);
            return (
              <circle
                key={`dot-${angle}`}
                cx={cx}
                cy={cy}
                r={2.5}
                className="fill-amber-500/50 dark:fill-amber-400/35"
              />
            );
          })}

          {/* Core — denser center */}
          <circle cx={60} cy={60} r={10} className="fill-amber-600/30 dark:fill-amber-500/20" />
          <circle cx={60} cy={60} r={5} className="fill-amber-700/40 dark:fill-amber-400/25" />
        </g>
      </g>
    </svg>
  );
}

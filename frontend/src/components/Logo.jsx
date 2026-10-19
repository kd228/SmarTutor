// SmarTutor mark: a pencil whose eraser is a brain. Drawn from simple shapes so it stays crisp at any size.
const LOBES = [
  [21, 14, 6.6], [25.5, 8.5, 6], [30, 12, 6.6],
  [43, 14, 6.6], [38.5, 8.5, 6], [34, 12, 6.6],
  [27, 19, 6], [37, 19, 6], [32, 17, 7],
];
const OUTLINE_GROW = 1.6;

export default function Logo({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <g transform="translate(27.4 34.2) rotate(28) scale(0.86) translate(-32 -33)">
        {/* brain: dark outline first, then yellow fill, then folds */}
        <g fill="#123a33">
          {LOBES.map(([cx, cy, r]) => <circle key={`o${cx}-${cy}`} cx={cx} cy={cy} r={r + OUTLINE_GROW} />)}
        </g>
        <g fill="#f4c430">
          {LOBES.map(([cx, cy, r]) => <circle key={`f${cx}-${cy}`} cx={cx} cy={cy} r={r} />)}
        </g>
        <g fill="none" stroke="#123a33" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M32 5.4 C30.4 8 33.6 10.4 32 13.8 C30.8 16.6 33 19.2 32 22.6" />
          <path d="M16.5 13 C19 10.8 21.2 14.2 24 12" />
          <path d="M21.5 20 C24 17.8 26 21 28.6 18.6" />
          <path d="M23.5 6.5 C25.5 8.4 27 6.8 28.4 9" />
          <path d="M47.5 13 C45 10.8 42.8 14.2 40 12" />
          <path d="M42.5 20 C40 17.8 38 21 35.4 18.6" />
          <path d="M40.5 6.5 C38.5 8.4 37 6.8 35.6 9" />
        </g>
        {/* ferrule */}
        <rect x="24" y="24.5" width="16" height="6" rx="1.4" fill="#f7f8f4" stroke="#123a33" strokeWidth="2" />
        <path d="M28.5 25.5 L28.5 29.5 M35.5 25.5 L35.5 29.5" fill="none" stroke="#123a33" strokeWidth="1.2" strokeLinecap="round" />
        {/* body */}
        <rect x="24.5" y="30.5" width="15" height="20" fill="#1c5246" stroke="#123a33" strokeWidth="2" strokeLinejoin="round" />
        <rect x="28.4" y="31.5" width="3" height="18" fill="#2f7867" />
        {/* sharpened wood and lead */}
        <path d="M24.5 50.5 L32 62.5 L39.5 50.5 Z" fill="#e8c88a" stroke="#123a33" strokeWidth="2" strokeLinejoin="round" />
        <path d="M29.6 58.5 L32 62.5 L34.4 58.5 Z" fill="#123a33" stroke="#123a33" strokeWidth="1.2" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

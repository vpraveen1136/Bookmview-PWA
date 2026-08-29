export function SkeletonGrid({ count = 6 }) {
  return (
    <ul className="video-grid video-grid-cols-2 skeleton-grid" aria-label="Loading videos">
      {Array.from({ length: count }).map((_, index) => (
        <li key={index}>
          <div className="skeleton-card" />
        </li>
      ))}
    </ul>
  );
}

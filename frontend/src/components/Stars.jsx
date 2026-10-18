export default function Stars({ rating, count }) {
  const rounded = Math.round(rating);
  return (
    <span className="stars" aria-label={`${rating} out of 5 stars`}>
      {'★'.repeat(rounded)}
      <span className="dim">{'★'.repeat(5 - rounded)}</span>
      {count !== undefined && (
        <span className="muted"> {rating ? rating.toFixed(1) : 'New'} ({count})</span>
      )}
    </span>
  );
}

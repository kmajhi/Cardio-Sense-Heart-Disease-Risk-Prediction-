export default function RecoveryChip({ recovery }) {
  if (!recovery) return null;
  return (
    <div className="pc-recovery pc-enter" style={{ '--d': '220ms' }}>
      <div>
        <p className="pc-recovery-label">{recovery.label}</p>
        <p className="pc-recovery-value">{recovery.value}</p>
      </div>
      <div className="pc-bars" aria-hidden="true">
        {recovery.bars.map((h, i) => (
          <span key={i} style={{ '--h': h }} />
        ))}
      </div>
    </div>
  );
}

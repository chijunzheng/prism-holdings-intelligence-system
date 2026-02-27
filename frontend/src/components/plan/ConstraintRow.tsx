interface ConstraintRowProps {
  readonly label: string
  readonly pass: boolean
}

export function ConstraintRow({ label, pass }: ConstraintRowProps) {
  return (
    <div className={`constraint-row ${pass ? 'constraint-row--pass' : 'constraint-row--fail'}`}>
      <span className="constraint-row__indicator">{pass ? '\u2713' : '\u2717'}</span>
      <span className="constraint-row__label">{label}</span>
    </div>
  )
}

export function RiskBadge({label,score}:{label:string;score:number}) { return <span className={`risk risk-${label.toLowerCase()}`}><b>{score}</b> {label}</span>; }

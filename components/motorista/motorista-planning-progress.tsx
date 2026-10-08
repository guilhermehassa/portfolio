import { decimal } from "@/lib/motorista";

export function PlanningProgress({ percent, showLabel = true }: {
  percent: number | null;
  showLabel?: boolean;
}) {
  const progress = percent === null ? null : Math.max(0, Math.min(100, percent));
  return (
    <>
      {progress !== null && (
        <div
          className="motorista-progress"
          role="progressbar"
          aria-label="Progresso da meta de saldo"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={`${decimal(percent!)}% da meta de saldo`}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
      )}
      {showLabel && (
        <p className="motorista-muted">
          {percent === null
            ? "Defina uma meta para calcular a necessidade."
            : `${decimal(percent)}% da meta de saldo.`}
        </p>
      )}
    </>
  );
}

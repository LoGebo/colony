'use client';

interface TicketSLAIndicatorProps {
  responseDueAt?: string | null;
  resolutionDueAt?: string | null;
  responseBreached?: boolean | null;
  resolutionBreached?: boolean | null;
  firstRespondedAt?: string | null;
  resolvedAt?: string | null;
}

function SLAChip({
  label,
  dueAt,
  breached,
  completedAt,
}: {
  label: string;
  dueAt?: string | null;
  breached?: boolean | null;
  completedAt?: string | null;
}) {
  if (!dueAt) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
        <span className="inline-block h-2 w-2 rounded-full bg-gray-300" />
        {label}
      </span>
    );
  }

  // Completed before due
  if (completedAt) {
    const onTime = new Date(completedAt).getTime() <= new Date(dueAt).getTime();
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs ${
          onTime ? 'text-green-700' : 'text-red-700'
        }`}
      >
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            onTime ? 'bg-green-500' : 'bg-red-500'
          }`}
        />
        {label}
      </span>
    );
  }

  // Breached
  if (breached) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700">
        <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
        {label}
      </span>
    );
  }

  // Approaching (< 2 hours)
  const hoursLeft = (new Date(dueAt).getTime() - Date.now()) / 3600000;
  if (hoursLeft < 2) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-yellow-700">
        <span className="inline-block h-2 w-2 rounded-full bg-yellow-500" />
        {label}
      </span>
    );
  }

  // On track
  return (
    <span className="inline-flex items-center gap-1 text-xs text-green-700">
      <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
      {label}
    </span>
  );
}

export function TicketSLAIndicator({
  responseDueAt,
  resolutionDueAt,
  responseBreached,
  resolutionBreached,
  firstRespondedAt,
  resolvedAt,
}: TicketSLAIndicatorProps) {
  return (
    <div className="flex items-center gap-3">
      <SLAChip
        label="Resp"
        dueAt={responseDueAt}
        breached={responseBreached}
        completedAt={firstRespondedAt}
      />
      <SLAChip
        label="Resol"
        dueAt={resolutionDueAt}
        breached={resolutionBreached}
        completedAt={resolvedAt}
      />
    </div>
  );
}

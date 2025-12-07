import type { ConnectionStatus as ConnectionStatusType } from '../types/scene';

interface ConnectionStatusProps {
  status: ConnectionStatusType;
  x32Name?: string;
}

const statusConfig = {
  connected: {
    label: 'Connected',
    className: 'status-connected',
    description: 'Connected to X32',
  },
  disconnected: {
    label: 'Disconnected',
    className: 'status-disconnected',
    description: 'Not connected to X32',
  },
  connecting: {
    label: 'Connecting...',
    className: 'status-connecting',
    description: 'Attempting to connect',
  },
  mock: {
    label: 'Mock Mode',
    className: 'status-mock',
    description: 'Using simulated data',
  },
};

export function ConnectionStatus({ status, x32Name }: ConnectionStatusProps) {
  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2 px-3 py-2 card py-2">
      <span className={`status-dot ${config.className}`} />
      <div className="flex flex-col">
        <span className="text-sm font-medium">{config.label}</span>
        <span className="text-xs empty-state">
          {x32Name || config.description}
        </span>
      </div>
    </div>
  );
}

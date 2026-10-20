import type { ReactNode } from 'react';
import { AppIcon, Button, Panel, type IconName } from '../../components/ui/Primitives';

export function SetupSection({
  title,
  subtitle,
  icon,
  onEdit,
  children,
}: {
  title: string;
  subtitle: string;
  icon: IconName;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <Panel className="settings-policy-section">
      <div className="settings-policy-header">
        <span className="settings-policy-icon">
          <AppIcon name={icon} size={28} />
        </span>
        <div>
          <div className="settings-policy-heading">
            <h2>{title}</h2>
          </div>
          <p>{subtitle}</p>
        </div>
        <Button
          variant="secondary"
          className="settings-edit"
          aria-label={`Edit ${title}`}
          onClick={onEdit}
        >
          <AppIcon name="edit" size={14} />
          Edit Details
        </Button>
      </div>
      {children}
    </Panel>
  );
}
export function Rule({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

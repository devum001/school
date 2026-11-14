import { useEffect, useState } from 'react';
import { Bell, AlertTriangle, AlertCircle, X } from 'lucide-react';
import {
  platformService,
  type ActiveSchoolAnnouncement,
} from '../../services/platformService';

type Props = {
  schoolId: string;
};

const THEMES = {
  info: {
    bg: '#eff8ff',
    border: '#b2ddff',
    color: '#175cd3',
    icon: Bell,
  },
  warning: {
    bg: '#fffaeb',
    border: '#fedf89',
    color: '#b54708',
    icon: AlertTriangle,
  },
  critical: {
    bg: '#fef3f2',
    border: '#fecdca',
    color: '#b42318',
    icon: AlertCircle,
  },
};

const DISMISSED_KEY = 'schoolwell_dismissed_announcements';

function getDismissedAnnouncements(): Record<string, boolean> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(DISMISSED_KEY) : null;
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persistDismissedAnnouncement(id: string) {
  try {
    const current = getDismissedAnnouncements();
    current[id] = true;
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(current));
  } catch {}
}

export default function GlobalAnnouncementBanner({ schoolId }: Props) {
  const [announcements, setAnnouncements] = useState<ActiveSchoolAnnouncement[]>([]);
  const [dismissed, setDismissed] = useState<Record<string, boolean>>(getDismissedAnnouncements);

  useEffect(() => {
    let cancelled = false;
    const fetchActive = async () => {
      try {
        const items = await platformService.activeSchoolAnnouncements(schoolId);
        if (!cancelled) setAnnouncements(items);
      } catch {
        // Silently ignore announcement fetch errors for uninterrupted school operations
      }
    };
    fetchActive();
    return () => {
      cancelled = true;
    };
  }, [schoolId]);

  const activeItems = announcements.filter((item) => !dismissed[item.id]);
  if (activeItems.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
      {activeItems.map((item) => {
        const theme = THEMES[item.severity] || THEMES.info;
        const IconComponent = theme.icon;
        return (
          <div
            key={item.id}
            role="alert"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 16px',
              backgroundColor: theme.bg,
              border: `1px solid ${theme.border}`,
              borderRadius: 10,
              color: theme.color,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
              <IconComponent size={18} style={{ flexShrink: 0 }} />
              <div style={{ fontSize: 13, lineHeight: 1.4 }}>
                <strong style={{ marginRight: 6 }}>{item.title}:</strong>
                <span>{item.message}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                persistDismissedAnnouncement(item.id);
                setDismissed((prev) => ({ ...prev, [item.id]: true }));
              }}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: theme.color,
                padding: 4,
                display: 'flex',
                alignItems: 'center',
              }}
              aria-label="Dismiss banner"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

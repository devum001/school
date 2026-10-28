import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SchoolFeatureContext, type SchoolFeatureData } from '../../app/schoolFeatureContext';
import { Button, LoadingOverlay, Panel } from '../../components/ui/Primitives';
import {
  cancelScheduledNotice,
  communicationFor,
  createNotice,
  dispatchCommunication,
  publishCommunication,
  reconcileCommunication,
  saveCommunicationSettings,
} from '../../lib/communication';
import { setLiveRepositoryAdapter } from '../../lib/repository';
import { apiService } from '../../services/apiService';
import type { DemoState } from '../../types/domain';
import { portalAccess } from '../live/portalAccess';
import { useLiveSchool } from '../live/schoolContext';
import { useRemote } from '../live/useRemote';
import CommunicationSettings from '../settings/CommunicationSettings';
import CommunicationWorkspace from './CommunicationWorkspace';

interface CommunicationSnapshotResponse {
  today: string;
  timezone: string;
  state: DemoState;
}

function hydrateCommunicationState(rawState: DemoState, today: string): DemoState {
  const baseCommunication = communicationFor(rawState);
  const withComm: DemoState = {
    ...rawState,
    communication: rawState.communication
      ? {
          ...baseCommunication,
          ...rawState.communication,
          settings: {
            ...baseCommunication.settings,
            ...(rawState.communication.settings ?? {}),
            templates: {
              ...baseCommunication.settings.templates,
              ...(rawState.communication.settings?.templates ?? {}),
            },
            channels:
              Array.isArray(rawState.communication.settings?.channels) &&
              rawState.communication.settings.channels.length > 0
                ? rawState.communication.settings.channels
                : baseCommunication.settings.channels,
          },
          records: Array.isArray(rawState.communication.records)
            ? rawState.communication.records
            : [],
          publishedTests: Array.isArray(rawState.communication.publishedTests)
            ? rawState.communication.publishedTests
            : [],
          publishedResults: Array.isArray(rawState.communication.publishedResults)
            ? rawState.communication.publishedResults
            : [],
        }
      : baseCommunication,
  };
  return reconcileCommunication(withComm, today);
}

export default function LiveNotificationsWorkspace({
  settingsMode = false,
}: {
  settingsMode?: boolean;
}) {
  const { schoolId, status, access } = useLiveSchool();
  const [params] = useSearchParams();
  const yearId = params.get('year') || status.currentAcademicYearId || '';
  const targetKey = `${schoolId}:${yearId}`;

  const load = useCallback(
    async (signal: AbortSignal) => {
      const query = yearId ? `?yearId=${encodeURIComponent(yearId)}` : '';
      const response = await apiService.request<CommunicationSnapshotResponse>(
        `/schools/${schoolId}/communication${query}`,
        { signal },
      );
      return {
        key: targetKey,
        value: {
          ...response,
          state: hydrateCommunicationState(response.state, response.today),
        },
      };
    },
    [schoolId, yearId, targetKey],
  );

  const remote = useRemote(load);

  if (remote.error) {
    return (
      <Panel title="Notifications unavailable">
        <p role="alert">{remote.error}</p>
        <Button onClick={remote.reload}>Retry</Button>
      </Panel>
    );
  }

  const isReady = Boolean(remote.data && remote.data.key === targetKey);
  const label = settingsMode ? 'Loading communication settings…' : 'Loading notifications…';

  if (!isReady || !remote.data) {
    return (
      <LoadingOverlay loading size="xl" label={label} message={label}>
        <Panel title={settingsMode ? 'Communication Settings' : 'Notifications'}>
          <div style={{ minHeight: 240 }} />
        </Panel>
      </LoadingOverlay>
    );
  }

  return (
    <LiveNotificationsContent
      key={`${targetKey}:${settingsMode ? 'settings' : 'workspace'}`}
      initial={remote.data.value}
      schoolId={schoolId}
      permissions={access.permissions}
      settingsMode={settingsMode}
    />
  );
}

function LiveNotificationsContent({
  initial,
  schoolId,
  permissions,
  settingsMode,
}: {
  initial: CommunicationSnapshotResponse;
  schoolId: string;
  permissions: readonly string[];
  settingsMode: boolean;
}) {
  const [state, setState] = useState<DemoState>(initial.state);
  const stateRef = useRef<DemoState>(initial.state);

  const persistCommunication = useCallback(
    (nextState: DemoState) => {
      stateRef.current = nextState;
      setState(nextState);
      if (nextState.communication) {
        void apiService
          .request(`/schools/${schoolId}/communication`, {
            method: 'PUT',
            body: nextState.communication,
          })
          .catch(() => {
            // Keep optimistic UI state; user can retry if needed.
          });
      }
    },
    [schoolId],
  );

  useEffect(() => {
    setLiveRepositoryAdapter({
      getSnapshot: () => stateRef.current,
      refreshCommunication(date) {
        const next = reconcileCommunication(stateRef.current, date || initial.today);
        const prevJson = JSON.stringify(stateRef.current.communication?.records ?? []);
        const nextJson = JSON.stringify(next.communication?.records ?? []);
        stateRef.current = next;
        setState(next);
        if (prevJson !== nextJson && next.communication) {
          void apiService
            .request(`/schools/${schoolId}/communication`, {
              method: 'PUT',
              body: next.communication,
            })
            .catch(() => {});
        }
      },
      dispatchCommunication(ids) {
        const next = dispatchCommunication(stateRef.current, ids);
        persistCommunication(next);
      },
      createNotice(input) {
        const next = createNotice(stateRef.current, input);
        persistCommunication(next);
      },
      cancelScheduledNotice(id) {
        const next = cancelScheduledNotice(stateRef.current, id);
        persistCommunication(next);
      },
      saveCommunicationSettings(settings) {
        const next = saveCommunicationSettings(stateRef.current, settings);
        persistCommunication(next);
      },
      publishCommunication(examId, results) {
        const next = publishCommunication(stateRef.current, examId, results);
        persistCommunication(next);
      },
    });
    return () => setLiveRepositoryAdapter(null);
  }, [initial.today, persistCommunication, schoolId]);

  const feature = useMemo<SchoolFeatureData>(
    () => ({
      mode: 'live',
      state,
      today: initial.today,
      canManage: true,
      canViewStudentProfiles: permissions.includes('students.view'),
      routeAllowed: portalAccess(permissions).allowed,
      unavailable: [],
      getSnapshot: () => stateRef.current,
      async createTest() {
        return '';
      },
      async updateTest() {},
      async deleteTest() {},
      async saveMarksSheets() {},
      async saveAttendance() {},
    }),
    [state, initial.today, permissions],
  );

  return (
    <SchoolFeatureContext.Provider value={feature}>
      {settingsMode ? <CommunicationSettings /> : <CommunicationWorkspace />}
    </SchoolFeatureContext.Provider>
  );
}

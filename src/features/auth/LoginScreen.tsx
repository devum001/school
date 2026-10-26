import { useState } from 'react';
import { GraduationCap, Eye, EyeOff, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button, Panel } from '../../components/ui/Primitives';
import { sessionStore } from './sessionStore';
import { useSession } from './useSession';
export default function LoginScreen() {
  const auth = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <main className="live-login school-signin">
      <aside className="signin-story">
        <div className="brand">
          <GraduationCap aria-hidden="true" /> schoolwell.
        </div>
        <div>
          <span className="signin-eyebrow">YOUR SCHOOL, CONNECTED</span>
          <h2>
            A clear start
            <br />
            to every school day.
          </h2>
          <p>One workspace for your people, attendance and school operations.</p>
        </div>
        <p className="signin-privacy">
          <ShieldCheck size={18} aria-hidden="true" /> Your account opens only the areas assigned to
          you.
        </p>
      </aside>
      <Panel>
        <div className="brand">
          <GraduationCap aria-hidden="true" /> schoolwell.
        </div>
        <span className="signin-eyebrow">WELCOME BACK</span>
        <h1>Sign in to your school</h1>
        <p>Use the account provided by your school administrator.</p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError('');
            try {
              await sessionStore.login(email, password);
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Unable to sign in.');
            } finally {
              setBusy(false);
              setPassword('');
            }
          }}
        >
          <label className="settings-field">
            Email
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={busy}
            />
          </label>
          <label className="settings-field">
            Password
            <span className="signin-password">
              <input
                type={visible ? 'text' : 'password'}
                autoComplete="current-password"
                required
                maxLength={64}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={busy}
              />
              <button
                type="button"
                className="icon-button"
                aria-label={visible ? 'Hide password' : 'Show password'}
                onClick={() => setVisible(!visible)}
              >
                {visible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>
          {(error || auth.error) && (
            <p role="alert" className="form-error">
              {error || auth.error}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'} <ArrowRight size={16} aria-hidden="true" />
          </Button>
        </form>
        <p className="panel-note">
          Account setup and access assistance are handled by your administrator.
        </p>
      </Panel>
    </main>
  );
}

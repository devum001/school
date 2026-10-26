import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button, Modal } from '../../components/ui/Primitives';
import {
  platformService as api,
  platformError,
  validateNewPassword,
  type NewAccount,
  type PlatformSchool,
  type PlatformUser,
} from '../../services/platformService';
export function AccountFields({
  value,
  onChange,
  disabled,
}: {
  value: NewAccount;
  onChange: (value: NewAccount) => void;
  disabled: boolean;
}) {
  return (
    <>
      <label>
        Account name
        <input
          required
          maxLength={120}
          value={value.name}
          disabled={disabled}
          onChange={(event) => onChange({ ...value, name: event.target.value })}
        />
      </label>
      <label>
        Account email
        <input
          type="email"
          required
          maxLength={254}
          autoComplete="off"
          value={value.email}
          disabled={disabled}
          onChange={(event) => onChange({ ...value, email: event.target.value })}
        />
      </label>
    </>
  );
}
export function PasswordFields({
  password,
  repeat,
  setPassword,
  setRepeat,
  disabled,
}: {
  password: string;
  repeat: string;
  setPassword: (value: string) => void;
  setRepeat: (value: string) => void;
  disabled: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeat, setShowRepeat] = useState(false);
  return (
    <>
      <label>
        Initial password
        <span className="password-input-wrap">
          <input
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="new-password"
            minLength={8}
            maxLength={64}
            value={password}
            disabled={disabled}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button
            type="button"
            aria-label={showPassword ? 'Hide initial password' : 'Show initial password'}
            onClick={() => setShowPassword((value) => !value)}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </span>
      </label>
      <label>
        Confirm password
        <span className="password-input-wrap">
          <input
            type={showRepeat ? 'text' : 'password'}
            required
            autoComplete="new-password"
            value={repeat}
            disabled={disabled}
            onChange={(event) => setRepeat(event.target.value)}
          />
          <button
            type="button"
            aria-label={showRepeat ? 'Hide confirm password' : 'Show confirm password'}
            onClick={() => setShowRepeat((value) => !value)}
          >
            {showRepeat ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </span>
      </label>
      <p>
        Use a unique 8–64 character password. Share it privately with the account holder; no email
        will be sent.
      </p>
    </>
  );
}
export function SchoolForm({
  school,
  close,
  saved,
}: {
  school?: PlatformSchool;
  close: () => void;
  saved: () => void;
}) {
  const [name, setName] = useState(school?.name ?? '');
  const [slug, setSlug] = useState(school?.slug ?? '');
  const [timezone, setTimezone] = useState(school?.timezone ?? 'Asia/Kolkata');
  const [code, setCode] = useState('');
  const [ownerMode, setOwnerMode] = useState('new');
  const [owner, setOwner] = useState<NewAccount>({ name: '', email: '', password: '' });
  const [repeat, setRepeat] = useState('');
  const [email, setEmail] = useState('');
  const [found, setFound] = useState<PlatformUser | null>(null);
  const [lookup, setLookup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Modal
      open
      onClose={() => {
        if (!busy && !lookup) close();
      }}
      title={school ? 'Edit school registration' : 'Create school'}
      description={
        school
          ? 'Update platform registration details. School operations remain with its owner.'
          : 'Assign an existing account as owner, or create a new owner account with this school.'
      }
    >
      <form
        className="live-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy || lookup) return;
          const passwordError =
            !school && ownerMode === 'new' ? validateNewPassword(owner.password, repeat) : '';
          if (passwordError) {
            setError(passwordError);
            return;
          }
          if (!school && ownerMode === 'existing' && !found) {
            setError('Find an active owner account first.');
            return;
          }
          setBusy(true);
          setError('');
          try {
            if (school)
              await api.updateSchool(school.id, {
                name: name.trim(),
                slug: slug.trim().toLowerCase(),
                timezone: timezone.trim(),
              });
            else
              await api.createSchool({
                name: name.trim(),
                slug: slug.trim().toLowerCase(),
                timezone: timezone.trim(),
                ...(code.trim() ? { code: code.trim().toUpperCase() } : {}),
                ...(ownerMode === 'new'
                  ? {
                      owner: {
                        ...owner,
                        name: owner.name.trim(),
                        email: owner.email.trim().toLowerCase(),
                      },
                    }
                  : { ownerUserId: found!.id }),
              });
            saved();
          } catch (cause) {
            setError(platformError(cause));
          } finally {
            setBusy(false);
            setOwner((current) => ({ ...current, password: '' }));
            setRepeat('');
          }
        }}
      >
        <label>
          School name
          <input
            required
            maxLength={160}
            disabled={busy}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          School slug
          <input
            required
            aria-describedby="school-slug-help"
            minLength={2}
            maxLength={80}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            disabled={busy}
            value={slug}
            onChange={(event) => setSlug(event.target.value.toLowerCase())}
          />
        </label>
        <small id="school-slug-help">
          A unique lowercase identifier, such as green-valley-school.
        </small>
        <label>
          Timezone
          <input
            required
            maxLength={80}
            disabled={busy}
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
          />
        </label>
        {!school && (
          <>
            <label>
              School code (optional)
              <input
                minLength={2}
                maxLength={32}
                disabled={busy}
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
              />
            </label>
            <label>
              School owner
              <select
                value={ownerMode}
                disabled={busy || lookup}
                onChange={(event) => {
                  setOwnerMode(event.target.value);
                  setError('');
                  setOwner((current) => ({ ...current, password: '' }));
                  setRepeat('');
                }}
              >
                <option value="new">Create a new owner account</option>
                <option value="existing">Use an existing account</option>
              </select>
            </label>
            {ownerMode === 'new' ? (
              <>
                <AccountFields value={owner} onChange={setOwner} disabled={busy} />
                <PasswordFields
                  password={owner.password}
                  repeat={repeat}
                  setPassword={(password) => setOwner((current) => ({ ...current, password }))}
                  setRepeat={setRepeat}
                  disabled={busy}
                />
              </>
            ) : (
              <>
                <label>
                  Existing owner email
                  <input
                    type="email"
                    required
                    value={email}
                    disabled={busy || lookup}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setFound(null);
                    }}
                  />
                </label>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy || lookup || !email.trim()}
                  onClick={async () => {
                    setLookup(true);
                    setError('');
                    setFound(null);
                    try {
                      const users = await api.users(
                        undefined,
                        undefined,
                        email.trim().toLowerCase(),
                      );
                      const user = users.items.find((item) => item.status === 'active');
                      if (!user) setError('No active account found for that email.');
                      else setFound(user);
                    } catch (cause) {
                      setError(platformError(cause));
                    } finally {
                      setLookup(false);
                    }
                  }}
                >
                  {lookup ? 'Finding account…' : 'Find owner account'}
                </Button>
                {found && (
                  <p role="status">
                    Selected owner: {found.name} ({found.email})
                  </p>
                )}
              </>
            )}
            <p>
              The owner receives full access to this school. Super Admin access does not give you a
              school membership.
            </p>
          </>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="live-actions">
          <Button type="button" variant="secondary" disabled={busy || lookup} onClick={close}>
            Cancel
          </Button>
          <Button disabled={busy || lookup || !name.trim() || !slug.trim()}>
            {busy ? 'Saving…' : school ? 'Save school' : 'Create school and owner'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function UserForm({
  user,
  close,
  saved,
}: {
  user?: PlatformUser;
  close: () => void;
  saved: () => void;
}) {
  const [account, setAccount] = useState<NewAccount>({
    name: user?.name ?? '',
    email: user?.email ?? '',
    password: '',
  });
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Modal
      open
      onClose={() => {
        if (!busy) close();
      }}
      title={user ? 'Edit account' : 'Create account'}
      description={
        user
          ? 'Changing email signs this account out of all devices.'
          : 'Create an ordinary account. School membership is assigned separately.'
      }
    >
      <form
        className="live-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          const invalid = !user ? validateNewPassword(account.password, repeat) : '';
          if (invalid) {
            setError(invalid);
            return;
          }
          setBusy(true);
          setError('');
          try {
            if (user)
              await api.updateUser(user.id, {
                name: account.name.trim(),
                email: account.email.trim().toLowerCase(),
              });
            else
              await api.createUser({
                ...account,
                name: account.name.trim(),
                email: account.email.trim().toLowerCase(),
              });
            saved();
          } catch (cause) {
            setError(platformError(cause));
          } finally {
            setBusy(false);
            setAccount((current) => ({ ...current, password: '' }));
            setRepeat('');
          }
        }}
      >
        <AccountFields value={account} onChange={setAccount} disabled={busy} />
        {!user && (
          <PasswordFields
            password={account.password}
            repeat={repeat}
            setPassword={(password) => setAccount((current) => ({ ...current, password }))}
            setRepeat={setRepeat}
            disabled={busy}
          />
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="live-actions">
          <Button type="button" variant="secondary" disabled={busy} onClick={close}>
            Cancel
          </Button>
          <Button disabled={busy || !account.name.trim()}>
            {busy ? 'Saving…' : user ? 'Save account' : 'Create account'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function PasswordReset({
  user,
  close,
  saved,
}: {
  user: PlatformUser;
  close: () => void;
  saved: () => void;
}) {
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Modal
      open
      onClose={() => {
        if (!busy) close();
      }}
      title="Reset account password"
      description={`Reset the password for ${user.email}. All existing sessions will be revoked.`}
    >
      <form
        className="live-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          const invalid = validateNewPassword(password, repeat);
          if (invalid) {
            setError(invalid);
            return;
          }
          setBusy(true);
          setError('');
          try {
            await api.resetPassword(user.id, password);
            saved();
          } catch (cause) {
            setError(platformError(cause));
          } finally {
            setBusy(false);
            setPassword('');
            setRepeat('');
          }
        }}
      >
        <PasswordFields
          password={password}
          repeat={repeat}
          setPassword={setPassword}
          setRepeat={setRepeat}
          disabled={busy}
        />
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="live-actions">
          <Button type="button" variant="secondary" disabled={busy} onClick={close}>
            Cancel
          </Button>
          <Button variant="danger" disabled={busy}>
            {busy ? 'Resetting…' : 'Confirm password reset'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

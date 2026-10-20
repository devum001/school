import { PickerInput } from '../../components/ui/Primitives';
export type StaffContact = {
  phone: string;
  email: string;
  joinedOn: string;
  qualification?: string;
};
export default function StaffContactFields({
  value,
  onChange,
  today,
  qualificationLimit = 150,
}: {
  value: StaffContact;
  onChange: (value: StaffContact) => void;
  today: string;
  qualificationLimit?: number;
}) {
  return (
    <div className="form-grid">
      <label className="field">
        Phone
        <input
          type="tel"
          value={value.phone}
          onChange={(e) => onChange({ ...value, phone: e.target.value })}
        />
      </label>
      <label className="field">
        Email
        <input
          type="email"
          value={value.email}
          onChange={(e) => onChange({ ...value, email: e.target.value })}
        />
      </label>
      <label className="field">
        Joining Date
        <PickerInput
          required
          type="date"
          max={today}
          value={value.joinedOn}
          onChange={(e) => onChange({ ...value, joinedOn: e.target.value })}
        />
      </label>
      <label className="field">
        Qualification
        <input
          maxLength={qualificationLimit}
          value={value.qualification ?? ''}
          onChange={(e) => onChange({ ...value, qualification: e.target.value })}
        />
      </label>
    </div>
  );
}

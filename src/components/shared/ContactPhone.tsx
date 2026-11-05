import { Phone } from 'lucide-react';
import { phoneHref } from '../../lib/contactPhone';
import './contact-phone.css';
export default function ContactPhone({
  phone,
  name = 'contact',
}: {
  phone?: string | null;
  name?: string;
}) {
  const href = phoneHref(phone || '');
  return href ? (
    <a className="contact-phone" href={href} aria-label={`Call ${name}: ${phone}`}>
      <Phone size={16} aria-hidden="true" />
      <span>{phone}</span>
    </a>
  ) : (
    <span>{phone || 'Not provided'}</span>
  );
}

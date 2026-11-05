import { expect, test } from 'vitest';
import { phoneHref } from './contactPhone';
test('call links preserve international dialing codes and strip display punctuation', () => {
  expect(phoneHref('+91 (98765) 43210')).toBe('tel:+919876543210');
  expect(phoneHref('0123-456-789')).toBe('tel:0123456789');
});
test.each(['javascript:alert(1)', 'tel:1234', '+12;555', '', 'N/A', '12'])(
  'does not construct a dialer link from %s',
  (phone) => expect(phoneHref(phone)).toBeNull(),
);

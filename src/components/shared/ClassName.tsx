import { ordinalClass } from '../../lib/classNames';
export default function ClassName({ name }: { name: string }) {
  const ordinal = ordinalClass(name);
  return ordinal ? (
    <span>
      {ordinal.level}
      <sup>{ordinal.suffix}</sup>
    </span>
  ) : (
    <span>{name}</span>
  );
}

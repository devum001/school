import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export default function TestTypePicker({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState(0);
  const choices = options.filter((option) =>
    option.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const custom = search.trim();
  if (custom && !options.some((option) => option.toLowerCase() === custom.toLowerCase()))
    choices.push(custom);
  useEffect(() => {
    if (open)
      document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, id, search]);
  const showAll = () => {
    setSearch('');
    setActive(Math.max(0, options.indexOf(value)));
    setOpen(true);
  };
  const choose = (choice: string) => {
    onChange(choice);
    setOpen(false);
  };

  return (
    <div
      className="field test-type-picker"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <label htmlFor={id}>Test type</label>
      <div className="test-type-control">
        <input
          ref={input}
          id={id}
          role="combobox"
          required
          autoComplete="off"
          maxLength={60}
          value={value}
          disabled={disabled}
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={`${id}-choices`}
          aria-activedescendant={open && choices[active] ? `${id}-option-${active}` : undefined}
          onFocus={showAll}
          onClick={() => {
            if (!open) showAll();
          }}
          onChange={(event) => {
            onChange(event.target.value);
            setSearch(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && open) {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
            } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              if (!open) showAll();
              else
                setActive((current) =>
                  Math.max(
                    0,
                    Math.min(choices.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1)),
                  ),
                );
            } else if (event.key === 'Enter' && open) {
              event.preventDefault();
              if (choices[active]) choose(choices[active]);
            }
          }}
        />
        <button
          type="button"
          className="test-type-toggle"
          aria-label="Show all test types"
          aria-expanded={open}
          aria-controls={`${id}-choices`}
          disabled={disabled}
          onClick={() => {
            if (open) setOpen(false);
            else {
              input.current?.focus();
              showAll();
            }
          }}
        >
          <ChevronDown size={17} aria-hidden="true" />
        </button>
      </div>
      {open && (
        <div
          id={`${id}-choices`}
          role="listbox"
          aria-label="Test types"
          className="test-type-options"
        >
          {choices.map((choice, index) => (
            <button
              key={choice}
              id={`${id}-option-${index}`}
              type="button"
              role="option"
              tabIndex={-1}
              aria-selected={choice === value}
              className={index === active ? 'active' : ''}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => choose(choice)}
            >
              <span>
                {choice === custom && !options.includes(choice) ? `Use “${choice}”` : choice}
              </span>
              {choice === value && <Check size={15} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

export type AutoSubmitSelectOption = {
  value: string;
  label: string;
};

export function AutoSubmitSelect({
  id,
  name,
  defaultValue,
  className,
  options
}: {
  id: string;
  name: string;
  defaultValue: string;
  className?: string;
  options: AutoSubmitSelectOption[];
}) {
  return (
    <select
      id={id}
      name={name}
      defaultValue={defaultValue}
      className={className}
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

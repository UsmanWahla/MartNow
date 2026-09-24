import Field from "./Field";

interface PersonFormProps {
  name: string;
  phone: string;
  nameError?: string;
  namePlaceholder?: string;
  onName: (value: string) => void;
  onPhone: (value: string) => void;
}

function PersonForm({
  name,
  phone,
  nameError,
  namePlaceholder = "Name",
  onName,
  onPhone,
}: PersonFormProps) {
  return (
    <>
      <Field
        placeholder={namePlaceholder}
        value={name}
        error={nameError}
        onChange={onName}
      />
      <Field
        placeholder="Phone (optional)"
        value={phone}
        onChange={onPhone}
      />
    </>
  );
}

export default PersonForm;

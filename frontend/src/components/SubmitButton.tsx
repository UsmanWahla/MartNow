interface SubmitButtonProps {
  loading?: boolean;
  idleLabel: string;
  loadingLabel: string;
}

function SubmitButton({ loading, idleLabel, loadingLabel }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="rounded-xl bg-teal-700 py-3 font-semibold text-white transition-colors duration-150 hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? loadingLabel : idleLabel}
    </button>
  );
}

export default SubmitButton;

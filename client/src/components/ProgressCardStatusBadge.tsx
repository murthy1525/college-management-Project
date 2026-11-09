export function ProgressCardStatusBadge({ status }: { status: "awaiting_signatures" | "fully_signed" }) {
  if (status === "fully_signed") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        Fully Signed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
      Awaiting Signatures
    </span>
  );
}

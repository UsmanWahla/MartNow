import { IconBox } from "./icons";

function BrandLogo() {
  return (
    <div className="mb-6 flex justify-center md:justify-start">
      <div className="grid h-12 w-12 place-items-center rounded-xl bg-teal-600 text-white shadow-sm">
        <IconBox className="h-6 w-6" />
      </div>
    </div>
  );
}

export default BrandLogo;

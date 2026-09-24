import { Navigate, useParams, useSearchParams } from "react-router-dom";

function ShopSignup() {
  const { slug = "" } = useParams();
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next") || `/shop/${slug}`;

  return (
    <Navigate
      to={`/register?next=${encodeURIComponent(next)}`}
      replace
    />
  );
}

export default ShopSignup;

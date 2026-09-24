import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { shopLoginPath } from "../../auth";

function ShopLogin() {
  const { slug = "" } = useParams();
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next") || `/shop/${slug}`;

  return <Navigate to={shopLoginPath(slug, next)} replace />;
}

export default ShopLogin;

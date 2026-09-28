export const storeCategoryOptions = [
  { value: "pharmacy", label: "Pharmacy" },
  { value: "book_shop", label: "Book Shop" },
  { value: "mart", label: "Mart / General Store" },
  { value: "clothing", label: "Clothing / Fashion" },
  { value: "electronics", label: "Electronics" },
  { value: "beauty", label: "Cosmetics / Beauty" },
  { value: "food", label: "Food / Restaurant" },
  { value: "other", label: "Other" },
];

export function categoryForStoreType(storeType: string) {
  return storeCategoryOptions.find((option) => option.label === storeType)?.value || "other";
}

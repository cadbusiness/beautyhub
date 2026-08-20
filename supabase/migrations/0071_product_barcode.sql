-- Code-barres / GTIN distinct du SKU (souvent différent sur WooCommerce).
alter table public.inst_products
  add column if not exists barcode text;

create index if not exists idx_inst_products_tenant_barcode
  on public.inst_products (tenant_id, barcode)
  where barcode is not null and barcode <> '';

-- Les SKU numériques déjà saisis (EAN/UPC) deviennent scannables tout de suite.
update public.inst_products
set barcode = trim(sku)
where barcode is null
  and sku is not null
  and trim(sku) ~ '^[0-9]{8,14}$';

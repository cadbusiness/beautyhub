-- BeautyHub - Nettoyage: suppression des colonnes WooCommerce en clair sur tenants.
-- Les credentials WooCommerce sont desormais geres via le framework de connexions
-- chiffrees (table public.connections, provider 'woocommerce').

alter table public.tenants drop column if exists woo_url;
alter table public.tenants drop column if exists woo_key;
alter table public.tenants drop column if exists woo_secret;

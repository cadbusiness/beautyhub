# Voucher Legacy Migration Plan

## Goal

Migrate `inst_gift_cards` and `inst_credit_notes` to `inst_vouchers` progressively, without interrupting POS or WooCommerce operations.

## Strategy

1. **Coexistence phase (active now)**  
   - New unified core tables: `inst_vouchers`, `inst_voucher_events`, `inst_voucher_links`.  
   - Legacy tables still readable/writable for backward compatibility.
   - Bridge view `inst_legacy_vouchers` provides a consolidated legacy balance view.

2. **Dual-read / dual-write period**  
   - POS reads vouchers first, then legacy fallback for old references.
   - Legacy issue flows mirror into voucher core through idempotent keys.
   - Woo redemption uses voucher core only.

3. **Tenant-by-tenant migration batches**  
   - For each tenant, run snapshot check (`computeVoucherMigrationSnapshot`) before and after.
   - Validate accounting invariants: total remaining balance legacy == total mirrored balance voucher (`deltaCents === 0`).
   - List unlinked legacy rows (`listUnlinkedLegacyVoucherCodes`) and repair links before cutover.

4. **Cutover**
   - Disable legacy issuance UI.
   - Keep read-only access to legacy for audit/history.
   - Keep idempotency logs in `inst_voucher_events`.

## Rollback

- If any tenant snapshot delta is non-zero, keep tenant in coexistence mode.
- Continue serving redemption from legacy fallback until links are repaired.

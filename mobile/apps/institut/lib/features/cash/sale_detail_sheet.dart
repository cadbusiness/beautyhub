import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../shared/money.dart';

Future<void> showSaleDetailSheet({
  required BuildContext context,
  required InstSale sale,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => _SaleDetailSheet(sale: sale),
  );
}

class _SaleDetailSheet extends StatelessWidget {
  const _SaleDetailSheet({required this.sale});
  final InstSale sale;

  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);
  static const _border = Color(0xFFE5E5E5);
  static const _fill = Color(0xFFF9FAFB);

  String _paymentLabel(String m) {
    switch (m) {
      case 'cash':
        return 'Espèces';
      case 'card':
        return 'Carte';
      case 'transfer':
        return 'Virement';
      case 'gift_card':
        return 'Carte cadeau';
      case 'store_credit':
        return 'Avoir';
      default:
        return m;
    }
  }

  @override
  Widget build(BuildContext context) {
    final date = DateFormat("EEEE d MMM y — HH'h'mm", 'fr_FR')
        .format(sale.createdAt);
    return FractionallySizedBox(
      heightFactor: 0.88,
      child: Column(
        children: [
          const SizedBox(height: 8),
          Container(
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: _border,
              borderRadius: BorderRadius.circular(99),
            ),
          ),
          const SizedBox(height: 14),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        sale.ticketNumber != null
                            ? 'Ticket #${sale.ticketNumber}'
                            : 'Vente',
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: _black,
                          letterSpacing: -0.2,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        date,
                        style: const TextStyle(fontSize: 12, color: _muted),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close_rounded, size: 22),
                  color: _muted,
                  splashRadius: 20,
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
              children: [
                if (sale.clientLabel != null)
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: _fill,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: _border),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.person_outline_rounded,
                            size: 18, color: _muted),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                sale.clientLabel!,
                                style: const TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: _black,
                                ),
                              ),
                              if (sale.clientEmail != null)
                                Text(
                                  sale.clientEmail!,
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: _muted,
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                if (sale.clientLabel != null) const SizedBox(height: 18),
                _SectionHeader('Articles'),
                const SizedBox(height: 6),
                Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: _border),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    children: [
                      for (var i = 0; i < sale.items.length; i++) ...[
                        _ItemRow(item: sale.items[i]),
                        if (i < sale.items.length - 1)
                          const Divider(
                            height: 1,
                            thickness: 1,
                            color: _border,
                            indent: 12,
                          ),
                      ],
                      if (sale.items.isEmpty)
                        const Padding(
                          padding: EdgeInsets.all(14),
                          child: Text(
                            'Aucun article détaillé.',
                            style: TextStyle(color: _muted, fontSize: 12),
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                _SectionHeader('Paiement'),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: _border),
                  ),
                  child: Column(
                    children: [
                      for (final p in sale.payments)
                        _KVRow(
                          label: _paymentLabel(p.method),
                          value: formatEuros(p.amountCents),
                        ),
                      if (sale.payments.isEmpty)
                        _KVRow(
                          label: _paymentLabel(sale.paymentMethod),
                          value: formatEuros(sale.amountPaidCents),
                        ),
                      const Divider(height: 16, thickness: 1, color: _border),
                      _KVRow(
                        label: 'Total encaissé',
                        value: formatEuros(sale.amountPaidCents),
                      ),
                      _KVRow(
                        label: 'Total ticket',
                        value: formatEuros(sale.totalCents),
                        bold: true,
                      ),
                      if (sale.status == 'partial')
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            'Solde restant : ${formatEuros(sale.totalCents - sale.amountPaidCents)}',
                            style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xFFB45309),
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                if (sale.notes != null && sale.notes!.isNotEmpty) ...[
                  const SizedBox(height: 18),
                  _SectionHeader('Notes'),
                  const SizedBox(height: 6),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: _fill,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: _border),
                    ),
                    child: Text(
                      sale.notes!,
                      style: const TextStyle(
                        fontSize: 13,
                        color: _black,
                        fontStyle: FontStyle.italic,
                        height: 1.4,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader(this.label);
  final String label;

  @override
  Widget build(BuildContext context) {
    return Text(
      label.toUpperCase(),
      style: const TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.6,
        color: _SaleDetailSheet._muted,
      ),
    );
  }
}

class _ItemRow extends StatelessWidget {
  const _ItemRow({required this.item});
  final InstSaleItem item;

  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);

  Color _serviceColor() {
    final hex = item.color;
    if (hex == null || hex.isEmpty) return const Color(0xFF64748B);
    try {
      var v = hex.replaceAll('#', '');
      if (v.length == 6) v = 'FF$v';
      return Color(int.parse(v, radix: 16));
    } catch (_) {
      return const Color(0xFF64748B);
    }
  }

  IconData _typeIcon() {
    if (item.isService) return Icons.spa_outlined;
    if (item.isGiftCard) return Icons.card_giftcard_outlined;
    if (item.isProduct) return Icons.shopping_bag_outlined;
    return Icons.receipt_long_outlined;
  }

  String _typeLabel() {
    if (item.isService) return 'Prestation';
    if (item.isGiftCard) return 'Carte cadeau';
    if (item.isProduct) return 'Produit';
    return 'Article';
  }

  @override
  Widget build(BuildContext context) {
    final lineTotal = item.lineTotalCents > 0
        ? item.lineTotalCents
        : item.unitPriceCents * item.quantity;
    final metaBits = <String>[];
    if (item.sku != null && item.sku!.isNotEmpty) metaBits.add('SKU ${item.sku}');
    if (item.durationMin != null) metaBits.add('${item.durationMin} min');
    if (item.wooId != null) metaBits.add('Woo #${item.wooId}');

    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _ItemThumb(item: item, color: _serviceColor(), fallback: _typeIcon()),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        item.name,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: _black,
                          height: 1.25,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      formatEuros(lineTotal),
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: _black,
                        fontFeatures: [FontFeature.tabularFigures()],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    Container(
                      padding:
                          const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF3F4F6),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        _typeLabel(),
                        style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: _muted,
                          letterSpacing: 0.3,
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      '${item.quantity} × ${formatEuros(item.unitPriceCents)}',
                      style: const TextStyle(
                        fontSize: 12,
                        color: _muted,
                        fontFeatures: [FontFeature.tabularFigures()],
                      ),
                    ),
                  ],
                ),
                if (metaBits.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    metaBits.join(' · '),
                    style: const TextStyle(fontSize: 11, color: _muted),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
                if (item.wooCategories.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Wrap(
                    spacing: 4,
                    runSpacing: 4,
                    children: item.wooCategories
                        .take(3)
                        .map(
                          (c) => Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFFEFF6FF),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              c,
                              style: const TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF1E40AF),
                              ),
                            ),
                          ),
                        )
                        .toList(),
                  ),
                ],
                if (item.description != null &&
                    item.description!.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(
                    item.description!,
                    style: const TextStyle(
                      fontSize: 12,
                      color: _muted,
                      height: 1.35,
                      fontStyle: FontStyle.italic,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
                if (item.discountCents > 0 || item.lineVatCents > 0) ...[
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      if (item.discountCents > 0) ...[
                        const Icon(
                          Icons.local_offer_outlined,
                          size: 12,
                          color: Color(0xFFB45309),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          'Remise ${formatEuros(item.discountCents)}',
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFFB45309),
                            fontFeatures: [FontFeature.tabularFigures()],
                          ),
                        ),
                      ],
                      if (item.discountCents > 0 && item.lineVatCents > 0)
                        const SizedBox(width: 10),
                      if (item.lineVatCents > 0)
                        Text(
                          'TVA ${formatEuros(item.lineVatCents)}',
                          style: const TextStyle(
                            fontSize: 11,
                            color: _muted,
                            fontFeatures: [FontFeature.tabularFigures()],
                          ),
                        ),
                    ],
                  ),
                ],
                if (item.stockQuantity != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    item.stockQuantity! <= 0
                        ? 'Stock épuisé'
                        : 'Stock : ${item.stockQuantity}',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: item.stockQuantity! <= 0
                          ? const Color(0xFFB91C1C)
                          : const Color(0xFF525252),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ItemThumb extends StatelessWidget {
  const _ItemThumb({
    required this.item,
    required this.color,
    required this.fallback,
  });

  final InstSaleItem item;
  final Color color;
  final IconData fallback;

  @override
  Widget build(BuildContext context) {
    const size = 52.0;
    if (item.imageUrl != null && item.imageUrl!.isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(10),
        child: Container(
          width: size,
          height: size,
          color: const Color(0xFFF5F5F5),
          child: Image.network(
            item.imageUrl!,
            fit: BoxFit.cover,
            errorBuilder: (_, _, _) => _fallback(),
          ),
        ),
      );
    }
    return _fallback();
  }

  Widget _fallback() {
    final bg = item.isService
        ? color.withValues(alpha: 0.12)
        : const Color(0xFFF3F4F6);
    final fg = item.isService ? color : const Color(0xFF525252);
    return Container(
      width: 52,
      height: 52,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Stack(
        alignment: Alignment.center,
        children: [
          Icon(fallback, size: 22, color: fg),
          if (item.quantity > 1)
            Positioned(
              right: 2,
              bottom: 2,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                decoration: BoxDecoration(
                  color: const Color(0xFF0A0A0A),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  '×${item.quantity}',
                  style: const TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _KVRow extends StatelessWidget {
  const _KVRow({
    required this.label,
    required this.value,
    this.bold = false,
  });
  final String label;
  final String value;
  final bool bold;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 13,
                color: bold
                    ? _SaleDetailSheet._black
                    : const Color(0xFF525252),
                fontWeight: bold ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: bold ? 15 : 13,
              fontWeight: FontWeight.w700,
              color: _SaleDetailSheet._black,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}

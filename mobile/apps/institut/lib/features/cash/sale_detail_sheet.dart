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

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
      child: Row(
        children: [
          Container(
            width: 26,
            height: 26,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: const Color(0xFFF3F4F6),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              '${item.quantity}',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: _SaleDetailSheet._black,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              item.name,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: _SaleDetailSheet._black,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(width: 8),
          Text(
            formatEuros(item.unitPriceCents * item.quantity),
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: _SaleDetailSheet._black,
              fontFeatures: [FontFeature.tabularFigures()],
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

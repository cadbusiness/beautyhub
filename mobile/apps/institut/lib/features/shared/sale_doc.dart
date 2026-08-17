import 'package:flutter/material.dart';

class SaleDocLook {
  const SaleDocLook({
    required this.icon,
    required this.foreground,
    required this.background,
    required this.border,
    required this.label,
  });

  final IconData icon;
  final Color foreground;
  final Color background;
  final Color border;
  final String label;
}

SaleDocLook saleDocLook(String docType) {
  switch (docType) {
    case 'invoice':
      return const SaleDocLook(
        icon: Icons.description_outlined,
        foreground: Color(0xFF1D4ED8),
        background: Color(0xFFEFF6FF),
        border: Color(0xFFBFDBFE),
        label: 'Facture',
      );
    case 'delivery_note':
      return const SaleDocLook(
        icon: Icons.local_shipping_outlined,
        foreground: Color(0xFF3F3F46),
        background: Color(0xFFF4F4F5),
        border: Color(0xFFE4E4E7),
        label: 'Bon',
      );
    case 'credit_note':
      return const SaleDocLook(
        icon: Icons.replay_outlined,
        foreground: Color(0xFF9F1239),
        background: Color(0xFFFFF1F2),
        border: Color(0xFFFECDD3),
        label: 'Avoir',
      );
    case 'ticket':
    default:
      return const SaleDocLook(
        icon: Icons.receipt_long_outlined,
        foreground: Color(0xFF9A3412),
        background: Color(0xFFFFF7ED),
        border: Color(0xFFFED7AA),
        label: 'Ticket',
      );
  }
}

class SaleDocMark extends StatelessWidget {
  const SaleDocMark({
    super.key,
    required this.docType,
    this.size = 32,
  });

  final String docType;
  final double size;

  @override
  Widget build(BuildContext context) {
    final look = saleDocLook(docType);
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: look.background,
        borderRadius: BorderRadius.circular(size >= 36 ? 10 : 8),
        border: Border.all(color: look.border),
      ),
      child: Icon(look.icon, size: size * 0.5, color: look.foreground),
    );
  }
}

String salePaymentLabel(String method) {
  switch (method) {
    case 'cash':
      return 'Espèces';
    case 'card':
      return 'CB';
    case 'stripe':
      return 'Stripe';
    case 'transfer':
      return 'Virement';
    case 'gift_card':
      return 'Bon-cadeau';
    case 'voucher':
      return 'Bon';
    case 'store_credit':
    case 'credit_note':
      return 'Avoir';
    case 'mixed':
      return 'Mixte';
    default:
      return method.isEmpty ? 'Paiement' : method;
  }
}

IconData salePaymentIcon(String method) {
  switch (method) {
    case 'cash':
      return Icons.payments_outlined;
    case 'card':
    case 'stripe':
      return Icons.credit_card;
    case 'transfer':
      return Icons.account_balance_outlined;
    case 'gift_card':
    case 'voucher':
      return Icons.card_giftcard_outlined;
    case 'store_credit':
    case 'credit_note':
      return Icons.replay_outlined;
    default:
      return Icons.payments_outlined;
  }
}

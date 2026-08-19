import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';

import '../shared/catalog_item_thumb.dart';
import '../shared/money.dart';

/// Ligne catalogue style POS pro : carte légère, sans divider pleine largeur.
class CatalogProductRow extends StatelessWidget {
  const CatalogProductRow({
    super.key,
    required this.item,
    required this.quantity,
    required this.onAdd,
    required this.onRemove,
    this.onTap,
  });

  final PosCatalogItem item;
  final int quantity;
  final VoidCallback onAdd;
  final VoidCallback onRemove;
  final VoidCallback? onTap;

  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);
  static const _border = Color(0xFFEBEBEB);

  @override
  Widget build(BuildContext context) {
    final inCart = quantity > 0;

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Ink(
            decoration: BoxDecoration(
              color: inCart ? const Color(0xFFF7F7F7) : Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: inCart ? const Color(0xFFD4D4D4) : _border,
              ),
            ),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(10, 10, 8, 10),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  CatalogItemThumb(
                    imageUrl: item.imageUrl,
                    colorHex: item.color,
                    category: item.category,
                    size: 52,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: _black,
                            height: 1.25,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _metaLine(),
                          style: const TextStyle(fontSize: 12, color: _muted),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  if (inCart)
                    _QtyControl(
                      quantity: quantity,
                      onAdd: onAdd,
                      onRemove: onRemove,
                    )
                  else
                    _AddButton(onTap: onAdd),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  String _metaLine() {
    final parts = <String>[formatEuros(item.priceCents)];
    if (item.category == 'service' && item.durationMin != null) {
      parts.add('${item.durationMin} min');
    }
    if (item.sku != null && item.sku!.isNotEmpty) {
      parts.add(item.sku!);
    }
    return parts.join(' · ');
  }
}

class _AddButton extends StatelessWidget {
  const _AddButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFF0A0A0A),
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: const SizedBox(
          width: 36,
          height: 36,
          child: Icon(Icons.add, color: Colors.white, size: 20),
        ),
      ),
    );
  }
}

class _QtyControl extends StatelessWidget {
  const _QtyControl({
    required this.quantity,
    required this.onAdd,
    required this.onRemove,
  });

  final int quantity;
  final VoidCallback onAdd;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFF5F5F5),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _QtyIcon(icon: Icons.remove, onTap: onRemove),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Text(
              '$quantity',
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          _QtyIcon(icon: Icons.add, onTap: onAdd),
        ],
      ),
    );
  }
}

class _QtyIcon extends StatelessWidget {
  const _QtyIcon({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: SizedBox(
        width: 32,
        height: 32,
        child: Icon(icon, size: 18, color: const Color(0xFF0A0A0A)),
      ),
    );
  }
}

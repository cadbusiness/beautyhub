import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/pos_cart_provider.dart';
import '../shared/catalog_item_thumb.dart';
import '../shared/money.dart';

void showCatalogItemDetailSheet(
  BuildContext context,
  WidgetRef ref, {
  required PosCatalogItem item,
}) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
    ),
    builder: (sheetContext) => Consumer(
      builder: (context, ref, _) {
        final quantity = ref.watch(posCartProvider)[item.key] ?? 0;
        return CatalogItemDetailSheet(
          item: item,
          quantity: quantity,
          onAdd: () => ref.read(posCartProvider.notifier).add(item.key),
          onRemove: () => ref.read(posCartProvider.notifier).removeOne(item.key),
        );
      },
    ),
  );
}

class CatalogItemDetailSheet extends StatelessWidget {
  const CatalogItemDetailSheet({
    super.key,
    required this.item,
    required this.quantity,
    required this.onAdd,
    required this.onRemove,
  });

  final PosCatalogItem item;
  final int quantity;
  final VoidCallback onAdd;
  final VoidCallback onRemove;

  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);

  @override
  Widget build(BuildContext context) {
    final description = item.description?.trim();
    final inCart = quantity > 0;

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.55,
      minChildSize: 0.4,
      maxChildSize: 0.9,
      builder: (context, scrollController) {
        return SingleChildScrollView(
          controller: scrollController,
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFFE5E5E5),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Center(
                child: CatalogItemThumb(
                  imageUrl: item.imageUrl,
                  colorHex: item.color,
                  category: item.category,
                  size: 120,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                item.name,
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: _black,
                  height: 1.25,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                formatEuros(item.priceCents),
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  color: _black,
                ),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  _InfoChip(label: item.categoryLabel),
                  if (item.durationMin != null)
                    _InfoChip(label: '${item.durationMin} min'),
                  if (item.sku != null && item.sku!.isNotEmpty)
                    _InfoChip(label: 'SKU ${item.sku}'),
                  if (item.stockQuantity != null)
                    _InfoChip(label: 'Stock ${item.stockQuantity}'),
                  if (item.wooId != null) _InfoChip(label: 'Woo #${item.wooId}'),
                ],
              ),
              if (item.wooCategories.isNotEmpty) ...[
                const SizedBox(height: 12),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: item.wooCategories
                      .map((c) => _InfoChip(label: c, subtle: true))
                      .toList(),
                ),
              ],
              if (description != null && description.isNotEmpty) ...[
                const SizedBox(height: 20),
                const Text(
                  'Description',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: _black,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  description,
                  style: const TextStyle(fontSize: 14, color: _muted, height: 1.45),
                ),
              ],
              const SizedBox(height: 24),
              if (inCart)
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: onRemove,
                        child: const Text('Retirer'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF5F5F5),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        '$quantity',
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: FilledButton(
                        onPressed: onAdd,
                        child: const Text('Ajouter'),
                      ),
                    ),
                  ],
                )
              else
                FilledButton.icon(
                  onPressed: () {
                    onAdd();
                    Navigator.pop(context);
                  },
                  icon: const Icon(Icons.add),
                  label: const Text('Ajouter au panier'),
                ),
            ],
          ),
        );
      },
    );
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.label, this.subtle = false});

  final String label;
  final bool subtle;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: subtle ? const Color(0xFFF5F5F5) : const Color(0xFF0A0A0A),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: subtle ? const Color(0xFF525252) : Colors.white,
        ),
      ),
    );
  }
}

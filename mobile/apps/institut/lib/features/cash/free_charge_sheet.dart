import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/pos_cart_provider.dart';
import '../../widgets/app_sheet.dart';

Future<bool> showFreeChargeSheet(BuildContext context, WidgetRef ref) async {
  final amount = TextEditingController();
  final label = TextEditingController();
  final added = await showAppSheet<bool>(
    context: context,
    builder: (ctx) {
      return Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 16,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
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
            const Text(
              'Encaissement libre',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: Color(0xFF0A0A0A),
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Un montant à encaisser, sans choisir un produit ou une prestation.',
              style: TextStyle(fontSize: 13, color: Color(0xFF737373), height: 1.35),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: amount,
              autofocus: true,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: _field('Montant (€)'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: label,
              textCapitalization: TextCapitalization.sentences,
              decoration: _field('Libellé (optionnel)'),
            ),
            const SizedBox(height: 16),
            SizedBox(
              height: 48,
              child: FilledButton(
                onPressed: () {
                  final parsed = double.tryParse(amount.text.replaceAll(',', '.'));
                  if (parsed == null || parsed <= 0) return;
                  final cents = (parsed * 100).round();
                  final key = createCustomPosKey(label.text);
                  ref.read(posCartProvider.notifier).add(key);
                  ref.read(posPriceOverridesProvider.notifier).setPrice(key, cents);
                  ref.read(posInjectedCatalogProvider.notifier).state =
                      mergeCustomCatalogItems(
                    current: ref.read(posInjectedCatalogProvider),
                    lines: ref.read(posCartProvider),
                    overrides: ref.read(posPriceOverridesProvider),
                  );
                  Navigator.pop(ctx, true);
                },
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF0A0A0A),
                  foregroundColor: Colors.white,
                ),
                child: const Text('Ajouter au panier'),
              ),
            ),
          ],
        ),
      );
    },
  );
  amount.dispose();
  label.dispose();
  return added == true;
}

InputDecoration _field(String hint) {
  return InputDecoration(
    hintText: hint,
    filled: true,
    fillColor: const Color(0xFFF5F5F5),
    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(10),
      borderSide: BorderSide.none,
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(10),
      borderSide: BorderSide.none,
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(10),
      borderSide: const BorderSide(color: Color(0xFF0A0A0A), width: 1.2),
    ),
  );
}

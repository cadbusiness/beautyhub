import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/pos_cart_provider.dart';
import '../../widgets/app_sheet.dart';

Future<bool> showFreeChargeSheet(BuildContext context, WidgetRef ref) async {
  final added = await showAppSheet<bool>(
    context: context,
    builder: (ctx) => Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(ctx).bottom),
      child: const _FreeChargeSheet(),
    ),
  );
  return added == true;
}

class _FreeChargeSheet extends ConsumerStatefulWidget {
  const _FreeChargeSheet();

  @override
  ConsumerState<_FreeChargeSheet> createState() => _FreeChargeSheetState();
}

class _FreeChargeSheetState extends ConsumerState<_FreeChargeSheet> {
  final _amount = TextEditingController();
  final _label = TextEditingController();

  @override
  void dispose() {
    _amount.dispose();
    _label.dispose();
    super.dispose();
  }

  void _submit() {
    final parsed = double.tryParse(_amount.text.replaceAll(',', '.'));
    if (parsed == null || parsed <= 0) return;
    final cents = (parsed * 100).round();
    final key = createCustomPosKey(_label.text);
    ref.read(posCartProvider.notifier).add(key);
    ref.read(posPriceOverridesProvider.notifier).setPrice(key, cents);
    ref.read(posInjectedCatalogProvider.notifier).state =
        mergeCustomCatalogItems(
      current: ref.read(posInjectedCatalogProvider),
      lines: ref.read(posCartProvider),
      overrides: ref.read(posPriceOverridesProvider),
    );
    Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
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
                  borderRadius: BorderRadius.circular(99),
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
              controller: _amount,
              autofocus: true,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              textInputAction: TextInputAction.next,
              decoration: _field('Montant (€)'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _label,
              textCapitalization: TextCapitalization.sentences,
              textInputAction: TextInputAction.done,
              onSubmitted: (_) => _submit(),
              decoration: _field('Libellé (optionnel)'),
            ),
            const SizedBox(height: 16),
            SizedBox(
              height: 48,
              child: FilledButton(
                onPressed: _submit,
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF0A0A0A),
                  foregroundColor: Colors.white,
                ),
                child: const Text('Ajouter au panier'),
              ),
            ),
          ],
        ),
      ),
    );
  }
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

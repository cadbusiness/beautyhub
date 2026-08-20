import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/pos_cart_provider.dart';

/// En-tête compact : titre + switch Session / Vente (sans double barre noire).
class CashScreenHeader extends ConsumerStatefulWidget {
  const CashScreenHeader({
    super.key,
    required this.selectedIndex,
    required this.onChanged,
  });

  final int selectedIndex;
  final ValueChanged<int> onChanged;

  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);
  static const _border = Color(0xFFE8E8E8);

  @override
  ConsumerState<CashScreenHeader> createState() => _CashScreenHeaderState();
}

class _CashScreenHeaderState extends ConsumerState<CashScreenHeader> {
  final _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<String>(posCatalogQueryProvider, (prev, next) {
      if (next.isEmpty && _searchController.text.isNotEmpty) {
        _searchController.clear();
      }
    });
    final onSaleTab = widget.selectedIndex == 1;
    return Material(
      color: Colors.white,
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Container(
              decoration: onSaleTab
                  ? null
                  : const BoxDecoration(
                      border: Border(
                        bottom: BorderSide(color: CashScreenHeader._border),
                      ),
                    ),
              padding: const EdgeInsets.fromLTRB(16, 6, 16, 8),
              child: Row(
                children: [
                  const Text(
                    'Caisse',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: CashScreenHeader._black,
                      letterSpacing: -0.3,
                    ),
                  ),
                  const Spacer(),
                  _Segment(
                    label: 'Session',
                    selected: widget.selectedIndex == 0,
                    onTap: () => widget.onChanged(0),
                  ),
                  const SizedBox(width: 6),
                  _Segment(
                    label: 'Vente',
                    selected: widget.selectedIndex == 1,
                    onTap: () => widget.onChanged(1),
                  ),
                  const SizedBox(width: 6),
                  _Segment(
                    label: 'Historique',
                    selected: widget.selectedIndex == 2,
                    onTap: () => widget.onChanged(2),
                  ),
                ],
              ),
            ),
            if (onSaleTab)
              _PinnedCatalogSearch(
                controller: _searchController,
                autofocus: true,
                onChanged: (value) {
                  ref.read(posCatalogQueryProvider.notifier).state = value;
                  setState(() {});
                },
                onSubmitted: (_) {
                  ref.read(posCatalogScanNonceProvider.notifier).state =
                      ref.read(posCatalogScanNonceProvider) + 1;
                },
              ),
          ],
        ),
      ),
    );
  }
}

class _PinnedCatalogSearch extends StatelessWidget {
  const _PinnedCatalogSearch({
    required this.controller,
    required this.onChanged,
    required this.onSubmitted,
    this.autofocus = false,
  });

  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final ValueChanged<String> onSubmitted;
  final bool autofocus;

  static const _fill = Color(0xFFF5F5F5);
  static const _muted = Color(0xFF737373);
  static const _black = Color(0xFF0A0A0A);
  static const _border = Color(0xFFE8E8E8);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: _border)),
      ),
      child: TextField(
        controller: controller,
        autofocus: autofocus,
        onChanged: onChanged,
        onSubmitted: onSubmitted,
        textInputAction: TextInputAction.search,
        decoration: InputDecoration(
          hintText: 'Rechercher ou scanner un article…',
          hintStyle: const TextStyle(color: _muted, fontSize: 14),
          prefixIcon: const Icon(
            Icons.search_rounded,
            size: 20,
            color: _muted,
          ),
          suffixIcon: controller.text.isNotEmpty
              ? IconButton(
                  onPressed: () {
                    controller.clear();
                    onChanged('');
                  },
                  icon: const Icon(Icons.close_rounded, size: 18),
                  color: _muted,
                  splashRadius: 18,
                )
              : null,
          filled: true,
          fillColor: _fill,
          isDense: true,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 12,
            vertical: 10,
          ),
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
            borderSide: const BorderSide(color: _black, width: 1.2),
          ),
        ),
      ),
    );
  }
}

class _Segment extends StatelessWidget {
  const _Segment({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? CashScreenHeader._black : const Color(0xFFF3F3F3),
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: selected ? Colors.white : CashScreenHeader._muted,
            ),
          ),
        ),
      ),
    );
  }
}

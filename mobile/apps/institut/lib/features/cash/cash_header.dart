import 'package:flutter/material.dart';

/// En-tête compact : titre + switch Session / Vente (sans double barre noire).
class CashScreenHeader extends StatelessWidget {
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
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      child: SafeArea(
        bottom: false,
        child: Container(
          decoration: const BoxDecoration(
            border: Border(bottom: BorderSide(color: _border)),
          ),
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 10),
          child: Row(
            children: [
              const Text(
                'Caisse',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: _black,
                  letterSpacing: -0.3,
                ),
              ),
              const Spacer(),
              _Segment(
                label: 'Session',
                selected: selectedIndex == 0,
                onTap: () => onChanged(0),
              ),
              const SizedBox(width: 6),
              _Segment(
                label: 'Vente',
                selected: selectedIndex == 1,
                onTap: () => onChanged(1),
              ),
              const SizedBox(width: 6),
              _Segment(
                label: 'Historique',
                selected: selectedIndex == 2,
                onTap: () => onChanged(2),
              ),
            ],
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

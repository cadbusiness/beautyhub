import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';

class AgendaStaffFilter extends StatelessWidget {
  const AgendaStaffFilter({
    super.key,
    required this.staff,
    required this.selectedStaffId,
    required this.onChanged,
  });

  final List<AgendaStaffMember> staff;
  final String? selectedStaffId;
  final ValueChanged<String?> onChanged;

  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);

  Color? _parseColor(String? hex) {
    if (hex == null || hex.isEmpty) return null;
    final cleaned = hex.replaceFirst('#', '');
    if (cleaned.length != 6) return null;
    return Color(int.parse('FF$cleaned', radix: 16));
  }

  @override
  Widget build(BuildContext context) {
    if (staff.isEmpty) return const SizedBox.shrink();

    return SizedBox(
      height: 40,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        children: [
          _Chip(
            label: 'Toute l’équipe',
            selected: selectedStaffId == null,
            onTap: () => onChanged(null),
          ),
          const SizedBox(width: 8),
          for (final member in staff) ...[
            _Chip(
              label: member.name,
              selected: selectedStaffId == member.id,
              dotColor: _parseColor(member.color),
              onTap: () => onChanged(member.id),
            ),
            const SizedBox(width: 8),
          ],
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({
    required this.label,
    required this.selected,
    required this.onTap,
    this.dotColor,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final Color? dotColor;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? AgendaStaffFilter._black : const Color(0xFFF3F3F3),
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (dotColor != null) ...[
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: dotColor,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 6),
              ],
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: selected ? Colors.white : AgendaStaffFilter._muted,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';

import '../../shared/cabin_badge.dart';

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

  @override
  Widget build(BuildContext context) {
    if (staff.length < 2) return const SizedBox.shrink();

    return _FilterRow(
      children: [
        _TextTab(
          label: 'Équipe',
          selected: selectedStaffId == null,
          onTap: () => onChanged(null),
        ),
        for (final member in staff)
          _TextTab(
            label: member.name.split(' ').first,
            selected: selectedStaffId == member.id,
            onTap: () => onChanged(member.id),
          ),
      ],
    );
  }
}

class AgendaResourceFilter extends StatelessWidget {
  const AgendaResourceFilter({
    super.key,
    required this.resources,
    required this.selectedResourceId,
    required this.onChanged,
  });

  final List<AgendaResource> resources;
  final String? selectedResourceId;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    if (resources.length < 2) return const SizedBox.shrink();

    return _FilterRow(
      children: [
        _TextTab(
          label: 'Toutes',
          selected: selectedResourceId == null,
          onTap: () => onChanged(null),
        ),
        for (final resource in resources)
          _CabinTab(
            label: resource.name,
            selected: selectedResourceId == resource.id,
            onTap: () => onChanged(resource.id),
          ),
      ],
    );
  }
}

class _FilterRow extends StatelessWidget {
  const _FilterRow({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (var i = 0; i < children.length; i++) ...[
            if (i > 0) const SizedBox(width: 4),
            children[i],
          ],
        ],
      ),
    );
  }
}

class _TextTab extends StatelessWidget {
  const _TextTab({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            color: selected ? const Color(0xFF0A0A0A) : const Color(0xFF737373),
          ),
        ),
      ),
    );
  }
}

class _CabinTab extends StatelessWidget {
  const _CabinTab({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
        child: Opacity(
          opacity: selected ? 1 : 0.45,
          child: CabinMark(label: label, size: 26),
        ),
      ),
    );
  }
}

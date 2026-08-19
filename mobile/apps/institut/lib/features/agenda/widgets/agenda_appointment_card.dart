import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../shared/cabin_badge.dart';
import '../../shared/money.dart';

class AgendaAppointmentCard extends StatelessWidget {
  const AgendaAppointmentCard({
    super.key,
    required this.appointment,
    required this.onTap,
    this.showTime = true,
  });

  final DayAppointment appointment;
  final VoidCallback onTap;
  final bool showTime;

  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);

  Color _accentColor() {
    final hex = appointment.serviceColor ?? appointment.staffColor;
    if (hex == null || hex.isEmpty) return _black;
    final cleaned = hex.replaceFirst('#', '');
    if (cleaned.length != 6) return _black;
    return Color(int.parse('FF$cleaned', radix: 16));
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'confirmed':
        return 'Confirmé';
      case 'completed':
        return 'Terminé';
      case 'cancelled':
        return 'Annulé';
      case 'no_show':
        return 'Absent';
      default:
        return 'Réservé';
    }
  }

  @override
  Widget build(BuildContext context) {
    final timeFmt = DateFormat.Hm();
    final accent = _accentColor();
    final cancelled = appointment.isCancelled;
    final serviceLine = [
      appointment.serviceName,
      if (appointment.durationLabel.isNotEmpty) appointment.durationLabel,
      if (appointment.staffName != null) appointment.staffName!,
    ].join(' · ');

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFE8E8E8)),
          ),
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 4,
                height: 44,
                decoration: BoxDecoration(
                  color: accent,
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        if (showTime) ...[
                          Text(
                            timeFmt.format(appointment.startsAt),
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: _black,
                              decoration: cancelled
                                  ? TextDecoration.lineThrough
                                  : null,
                            ),
                          ),
                          const SizedBox(width: 8),
                        ],
                        if (appointment.resourceName != null)
                          Flexible(
                            child: Align(
                              alignment: Alignment.centerLeft,
                              child: CabinBadge(
                                label: appointment.resourceName!,
                                compact: true,
                              ),
                            ),
                          )
                        else
                          const Spacer(),
                        if (appointment.status != 'booked')
                          _StatusPill(
                            label: _statusLabel(appointment.status),
                            status: appointment.status,
                          ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      appointment.clientName,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: _black,
                        decoration: cancelled
                            ? TextDecoration.lineThrough
                            : null,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      serviceLine,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12, color: _muted),
                    ),
                    if (appointment.priceCents != null &&
                        appointment.priceCents! > 0) ...[
                      const SizedBox(height: 6),
                      Text(
                        formatEuros(appointment.priceCents!),
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: _black,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class AgendaTimeGroup extends StatelessWidget {
  const AgendaTimeGroup({
    super.key,
    required this.group,
    required this.onTap,
  });

  final AppointmentTimeGroup group;
  final ValueChanged<DayAppointment> onTap;

  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);

  @override
  Widget build(BuildContext context) {
    final timeFmt = DateFormat.Hm();
    final parallel = group.isParallel;

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 48,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  timeFmt.format(group.startsAt),
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: _black,
                  ),
                ),
                if (parallel) ...[
                  const SizedBox(height: 2),
                  Text(
                    '${group.appointments.length} cab.',
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: _muted,
                    ),
                  ),
                ],
              ],
            ),
          ),
          Expanded(
            child: Column(
              children: [
                for (var i = 0; i < group.appointments.length; i++) ...[
                  if (i > 0) const SizedBox(height: 8),
                  AgendaAppointmentCard(
                    appointment: group.appointments[i],
                    showTime: false,
                    onTap: () => onTap(group.appointments[i]),
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

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.label, required this.status});

  final String label;
  final String status;

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color fg;
    switch (status) {
      case 'completed':
        bg = const Color(0xFFE8F5E9);
        fg = const Color(0xFF2E7D32);
      case 'cancelled':
      case 'no_show':
        bg = const Color(0xFFF5F5F5);
        fg = const Color(0xFF737373);
      case 'confirmed':
        bg = const Color(0xFFE3F2FD);
        fg = const Color(0xFF1565C0);
      default:
        bg = const Color(0xFFF3F3F3);
        fg = const Color(0xFF0A0A0A);
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: fg,
        ),
      ),
    );
  }
}

import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../shared/money.dart';

class AgendaAppointmentCard extends StatelessWidget {
  const AgendaAppointmentCard({
    super.key,
    required this.appointment,
    required this.onTap,
  });

  final DayAppointment appointment;
  final VoidCallback onTap;

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

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
      child: Material(
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
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  width: 4,
                  decoration: BoxDecoration(
                    color: accent,
                    borderRadius: const BorderRadius.horizontal(
                      left: Radius.circular(14),
                    ),
                  ),
                ),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              timeFmt.format(appointment.startsAt),
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: _black,
                                decoration: cancelled
                                    ? TextDecoration.lineThrough
                                    : null,
                              ),
                            ),
                            const Spacer(),
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
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: _black,
                            decoration: cancelled
                                ? TextDecoration.lineThrough
                                : null,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          [
                            appointment.serviceName,
                            if (appointment.staffName != null)
                              appointment.staffName!,
                          ].join(' · '),
                          style: const TextStyle(fontSize: 13, color: _muted),
                        ),
                        if (appointment.priceCents != null &&
                            appointment.priceCents! > 0) ...[
                          const SizedBox(height: 8),
                          Text(
                            formatEuros(appointment.priceCents!),
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: _black,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
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

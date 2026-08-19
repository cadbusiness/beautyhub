import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../shared/cabin_badge.dart';
import '../../shared/money.dart';
import '../agenda_colors.dart';
import '../agenda_format.dart';

class AgendaTimeGroup extends StatelessWidget {
  const AgendaTimeGroup({
    super.key,
    required this.group,
    required this.onTap,
    this.showDivider = true,
  });

  final AppointmentTimeGroup group;
  final ValueChanged<DayAppointment> onTap;
  final bool showDivider;

  static const _black = Color(0xFF0A0A0A);
  static const _line = Color(0xFFE8E8E8);

  @override
  Widget build(BuildContext context) {
    final timeFmt = DateFormat.Hm();
    final sideBySide = group.appointments.length == 2;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 14, 20, 14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: 44,
                child: Text(
                  timeFmt.format(group.startsAt),
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    letterSpacing: -0.2,
                    color: _black,
                  ),
                ),
              ),
              Expanded(
                child: sideBySide
                    ? Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: _AgendaSlot(
                              appointment: group.appointments[0],
                              onTap: () => onTap(group.appointments[0]),
                            ),
                          ),
                          Container(
                            width: 1,
                            height: 52,
                            margin: const EdgeInsets.symmetric(horizontal: 12),
                            color: _line,
                          ),
                          Expanded(
                            child: _AgendaSlot(
                              appointment: group.appointments[1],
                              onTap: () => onTap(group.appointments[1]),
                            ),
                          ),
                        ],
                      )
                    : Column(
                        children: [
                          for (var i = 0; i < group.appointments.length; i++) ...[
                            if (i > 0) const SizedBox(height: 12),
                            _AgendaSlot(
                              appointment: group.appointments[i],
                              onTap: () => onTap(group.appointments[i]),
                            ),
                          ],
                        ],
                      ),
              ),
            ],
          ),
        ),
        if (showDivider)
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 20),
            child: Divider(height: 1, color: _line),
          ),
      ],
    );
  }
}

class _AgendaSlot extends StatelessWidget {
  const _AgendaSlot({
    required this.appointment,
    required this.onTap,
  });

  final DayAppointment appointment;
  final VoidCallback onTap;

  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);

  String? _exceptionLabel() {
    switch (appointment.status) {
      case 'completed':
        return 'Terminé';
      case 'cancelled':
        return 'Annulé';
      case 'no_show':
        return 'Absent';
      default:
        return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final cancelled = appointment.isCancelled;
    final exception = _exceptionLabel();
    final price = appointment.priceCents;
    final cabin = appointment.resourceName;
    final accent = agendaAccentColor(appointment);
    final pastel = agendaPastel(accent);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Opacity(
          opacity: cancelled ? 0.55 : 1,
          child: Container(
            decoration: BoxDecoration(
              color: pastel,
              borderRadius: BorderRadius.circular(10),
              border: Border(left: BorderSide(color: accent, width: 4)),
            ),
            padding: const EdgeInsets.fromLTRB(10, 10, 12, 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    if (cabin != null) ...[
                      CabinMark(label: cabin, size: 20),
                      const SizedBox(width: 8),
                    ],
                    Expanded(
                      child: Text(
                        appointment.clientName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: _black,
                          decoration:
                              cancelled ? TextDecoration.lineThrough : null,
                        ),
                      ),
                    ),
                    if (price != null && price > 0) ...[
                      const SizedBox(width: 8),
                      Text(
                        formatEuros(price),
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: _black,
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  [
                    appointmentServiceLine(appointment),
                    ?exception,
                  ].join(' · '),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12, color: _muted, height: 1.25),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

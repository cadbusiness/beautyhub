import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../shared/cabin_badge.dart';
import '../../shared/money.dart';

class NextAppointmentHero extends StatelessWidget {
  const NextAppointmentHero({
    super.key,
    required this.appointments,
    required this.onCheckout,
    required this.onAgenda,
    this.onTapAppointment,
  });

  final List<DayAppointment> appointments;
  final VoidCallback onCheckout;
  final VoidCallback onAgenda;
  final ValueChanged<DayAppointment>? onTapAppointment;

  static const _black = Color(0xFF0A0A0A);

  String _countdown(DateTime startsAt) {
    final diff = startsAt.difference(DateTime.now());
    if (diff.inMinutes <= 0) return 'Maintenant';
    if (diff.inHours >= 1) {
      final mins = diff.inMinutes % 60;
      return mins > 0
          ? 'Dans ${diff.inHours} h $mins min'
          : 'Dans ${diff.inHours} h';
    }
    return 'Dans ${diff.inMinutes} min';
  }

  @override
  Widget build(BuildContext context) {
    if (appointments.isEmpty) return const SizedBox.shrink();

    final timeFmt = DateFormat.Hm();
    final dateFmt = DateFormat('EEEE d MMMM', 'fr_FR');
    final first = appointments.first;
    final parallel = appointments.length > 1;

    return Container(
      decoration: BoxDecoration(
        color: _black,
        borderRadius: BorderRadius.circular(18),
      ),
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                _countdown(first.startsAt).toUpperCase(),
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.8,
                  color: Colors.white.withValues(alpha: 0.55),
                ),
              ),
              const Spacer(),
              Text(
                dateFmt.format(first.startsAt),
                style: TextStyle(
                  fontSize: 11,
                  color: Colors.white.withValues(alpha: 0.45),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                timeFmt.format(first.startsAt),
                style: const TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                  letterSpacing: -1,
                  height: 1,
                ),
              ),
              if (parallel) ...[
                const SizedBox(width: 10),
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Text(
                    '${appointments.length} cabines',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Colors.white.withValues(alpha: 0.55),
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 14),
          for (var i = 0; i < appointments.length; i++) ...[
            if (i > 0) ...[
              const SizedBox(height: 10),
              Divider(
                height: 1,
                color: Colors.white.withValues(alpha: 0.12),
              ),
              const SizedBox(height: 10),
            ],
            _HeroAppointmentRow(
              appointment: appointments[i],
              onTap: onTapAppointment == null
                  ? null
                  : () => onTapAppointment!(appointments[i]),
            ),
          ],
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: FilledButton(
                  onPressed: onCheckout,
                  style: FilledButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: _black,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text(
                    'Encaisser',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              IconButton.filled(
                onPressed: onAgenda,
                style: IconButton.styleFrom(
                  backgroundColor: Colors.white.withValues(alpha: 0.12),
                  foregroundColor: Colors.white,
                ),
                icon: const Icon(Icons.calendar_today_outlined, size: 20),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _HeroAppointmentRow extends StatelessWidget {
  const _HeroAppointmentRow({
    required this.appointment,
    this.onTap,
  });

  final DayAppointment appointment;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final price = appointment.priceCents;
    final serviceLine = [
      appointment.serviceName,
      if (appointment.durationLabel.isNotEmpty) appointment.durationLabel,
      if (appointment.staffName != null) appointment.staffName!,
    ].join(' · ');

    final content = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                appointment.clientName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                ),
              ),
            ),
            if (appointment.resourceName != null) ...[
              const SizedBox(width: 8),
              CabinBadge(
                label: appointment.resourceName!,
                compact: true,
                onDark: true,
              ),
            ],
          ],
        ),
        const SizedBox(height: 3),
        Text(
          serviceLine,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: 12,
            color: Colors.white.withValues(alpha: 0.65),
          ),
        ),
        if (price != null && price > 0) ...[
          const SizedBox(height: 4),
          Text(
            formatEuros(price),
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: Colors.white.withValues(alpha: 0.85),
            ),
          ),
        ],
      ],
    );

    if (onTap == null) return content;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: content,
    );
  }
}

class EmptyNextAppointmentCard extends StatelessWidget {
  const EmptyNextAppointmentCard({
    super.key,
    required this.onNewAppointment,
  });

  final VoidCallback onNewAppointment;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE8E8E8)),
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'PROCHAIN RDV',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.8,
              color: Color(0xFF737373),
            ),
          ),
          const SizedBox(height: 12),
          const Text(
            'Aucun rendez-vous à venir',
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w600,
              color: Color(0xFF0A0A0A),
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Votre journée est libre ou vos créneaux sont terminés.',
            style: TextStyle(fontSize: 13, color: Color(0xFF737373)),
          ),
          const SizedBox(height: 16),
          OutlinedButton(
            onPressed: onNewAppointment,
            style: OutlinedButton.styleFrom(
              foregroundColor: const Color(0xFF0A0A0A),
              side: const BorderSide(color: Color(0xFF0A0A0A)),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: const Text(
              'Nouveau rendez-vous',
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

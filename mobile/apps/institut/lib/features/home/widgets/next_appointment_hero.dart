import 'dart:async';

import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../agenda/agenda_format.dart';
import '../../shared/cabin_badge.dart';
import '../../shared/money.dart';

class NextAppointmentHero extends StatefulWidget {
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

  @override
  State<NextAppointmentHero> createState() => _NextAppointmentHeroState();
}

class _NextAppointmentHeroState extends State<NextAppointmentHero> {
  Timer? _timer;

  static const _black = Color(0xFF0A0A0A);

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.appointments.isEmpty) return const SizedBox.shrink();

    final timeFmt = DateFormat.Hm();
    final first = widget.appointments.first;
    final countdown = liveCountdownLabel(first.startsAt);

    return Container(
      decoration: BoxDecoration(
        color: _black,
        borderRadius: BorderRadius.circular(16),
      ),
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  countdown,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Colors.white.withValues(alpha: 0.7),
                  ),
                ),
              ),
              Text(
                timeFmt.format(first.startsAt),
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                  letterSpacing: -0.4,
                  height: 1,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          for (var i = 0; i < widget.appointments.length; i++) ...[
            if (i > 0) const SizedBox(height: 8),
            _HeroAppointmentRow(
              appointment: widget.appointments[i],
              onTap: widget.onTapAppointment == null
                  ? null
                  : () => widget.onTapAppointment!(widget.appointments[i]),
            ),
          ],
          const SizedBox(height: 10),
          Row(
            children: [
              _HeroCircleAction(
                icon: Icons.calendar_today_outlined,
                label: 'Agenda',
                emphasized: false,
                onTap: widget.onAgenda,
              ),
              const Spacer(),
              _HeroCircleAction(
                icon: Icons.point_of_sale_outlined,
                label: 'Encaisser',
                emphasized: true,
                onTap: widget.onCheckout,
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
    final content = Row(
      children: [
        if (appointment.resourceName != null) ...[
          CabinMark(label: appointment.resourceName!, size: 20),
          const SizedBox(width: 8),
        ],
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                appointment.clientName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                ),
              ),
              Text(
                appointmentServiceLine(appointment),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.white.withValues(alpha: 0.55),
                ),
              ),
            ],
          ),
        ),
        if (price != null && price > 0) ...[
          const SizedBox(width: 8),
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

class _HeroCircleAction extends StatelessWidget {
  const _HeroCircleAction({
    required this.icon,
    required this.label,
    required this.emphasized,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool emphasized;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 2),
          child: Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: emphasized
                      ? Colors.white
                      : Colors.white.withValues(alpha: 0.14),
                ),
                child: Icon(
                  icon,
                  size: 16,
                  color: emphasized ? const Color(0xFF0A0A0A) : Colors.white,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: emphasized ? FontWeight.w700 : FontWeight.w600,
                  color: emphasized
                      ? Colors.white
                      : Colors.white.withValues(alpha: 0.8),
                ),
              ),
            ],
          ),
        ),
      ),
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
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE8E8E8)),
      ),
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
      child: Row(
        children: [
          const Expanded(
            child: Text(
              'Aucun rendez-vous à venir',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: Color(0xFF0A0A0A),
              ),
            ),
          ),
          TextButton(
            onPressed: onNewAppointment,
            style: TextButton.styleFrom(
              foregroundColor: const Color(0xFF0A0A0A),
              padding: EdgeInsets.zero,
              minimumSize: const Size(0, 36),
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: const Text('Nouveau'),
          ),
        ],
      ),
    );
  }
}

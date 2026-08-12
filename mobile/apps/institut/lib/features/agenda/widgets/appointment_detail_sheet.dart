import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../state/session_providers.dart';
import '../../shared/money.dart';

Future<void> showAppointmentDetailSheet(
  BuildContext context,
  WidgetRef ref,
  DayAppointment appointment,
) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (ctx) => _AppointmentDetailSheet(appointment: appointment),
  );
}

class _AppointmentDetailSheet extends ConsumerStatefulWidget {
  const _AppointmentDetailSheet({required this.appointment});

  final DayAppointment appointment;

  @override
  ConsumerState<_AppointmentDetailSheet> createState() =>
      _AppointmentDetailSheetState();
}

class _AppointmentDetailSheetState
    extends ConsumerState<_AppointmentDetailSheet> {
  bool _updating = false;
  String? _error;

  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);

  Future<void> _setStatus(String status) async {
    final token = ref.read(accessTokenProvider);
    final tenantId = ref.read(selectedTenantIdProvider);
    if (token == null || tenantId == null) return;

    setState(() {
      _updating = true;
      _error = null;
    });

    try {
      await ref.read(mobileApiProvider).updateAppointment(
            accessToken: token,
            tenantId: tenantId,
            appointmentId: widget.appointment.id,
            status: status,
          );
      ref.invalidate(dayAgendaProvider);
      ref.invalidate(todayAgendaProvider);
      if (mounted) Navigator.pop(context);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _updating = false);
    }
  }

  void _openCheckout() {
    ref.read(cashInitialTabProvider.notifier).state = 1;
    Navigator.pop(context);
    context.go('/app/cash');
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
    final a = widget.appointment;
    final dateFmt = DateFormat('EEEE d MMMM', 'fr_FR');
    final timeFmt = DateFormat.Hm();
    final cancelled = a.isCancelled;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
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
            const SizedBox(height: 20),
            Text(
              a.clientName,
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w700,
                color: _black,
                decoration: cancelled ? TextDecoration.lineThrough : null,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              a.serviceName,
              style: const TextStyle(fontSize: 15, color: _muted),
            ),
            const SizedBox(height: 16),
            _DetailRow(
              icon: Icons.schedule_outlined,
              label:
                  '${dateFmt.format(a.startsAt)} · ${timeFmt.format(a.startsAt)} – ${timeFmt.format(a.endsAt)}',
            ),
            if (a.staffName != null)
              _DetailRow(
                icon: Icons.person_outline,
                label: a.staffName!,
              ),
            if (a.clientPhone != null && a.clientPhone!.isNotEmpty)
              _DetailRow(
                icon: Icons.phone_outlined,
                label: a.clientPhone!,
              ),
            if (a.priceCents != null && a.priceCents! > 0)
              _DetailRow(
                icon: Icons.euro_outlined,
                label: formatEuros(a.priceCents!),
              ),
            _DetailRow(
              icon: Icons.flag_outlined,
              label: _statusLabel(a.status),
            ),
            if (a.notes != null && a.notes!.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                a.notes!,
                style: const TextStyle(fontSize: 14, color: _muted, height: 1.4),
              ),
            ],
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(color: Colors.red)),
            ],
            const SizedBox(height: 20),
            if (!cancelled && a.status != 'completed') ...[
              FilledButton(
                onPressed: _updating ? null : _openCheckout,
                child: const Text('Encaisser'),
              ),
              const SizedBox(height: 10),
            ],
            if (!cancelled) ...[
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  if (a.status != 'confirmed' && a.status != 'completed')
                    _ActionChip(
                      label: 'Confirmer',
                      loading: _updating,
                      onTap: () => _setStatus('confirmed'),
                    ),
                  if (a.status != 'completed')
                    _ActionChip(
                      label: 'Terminer',
                      loading: _updating,
                      onTap: () => _setStatus('completed'),
                    ),
                  if (a.status != 'cancelled')
                    _ActionChip(
                      label: 'Annuler',
                      loading: _updating,
                      onTap: () => _setStatus('cancelled'),
                    ),
                  if (a.status != 'no_show' && a.status != 'completed')
                    _ActionChip(
                      label: 'Absent',
                      loading: _updating,
                      onTap: () => _setStatus('no_show'),
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Icon(icon, size: 18, color: const Color(0xFF737373)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              label,
              style: const TextStyle(fontSize: 14, color: Color(0xFF0A0A0A)),
            ),
          ),
        ],
      ),
    );
  }
}

class _ActionChip extends StatelessWidget {
  const _ActionChip({
    required this.label,
    required this.onTap,
    this.loading = false,
  });

  final String label;
  final VoidCallback onTap;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      onPressed: loading ? null : onTap,
      style: OutlinedButton.styleFrom(
        foregroundColor: const Color(0xFF0A0A0A),
        side: const BorderSide(color: Color(0xFFE8E8E8)),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      ),
      child: Text(label),
    );
  }
}

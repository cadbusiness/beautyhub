import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../state/pos_cart_provider.dart';
import '../../../state/session_providers.dart';
import '../../clients/client_detail_sheet.dart';
import '../../shared/money.dart';
import '../../../widgets/app_sheet.dart';
import 'appointment_edit_sheet.dart';

Future<void> showAppointmentDetailSheet(
  BuildContext context,
  WidgetRef ref,
  DayAppointment appointment,
) {
  return showAppSheet<void>(
    context: context,
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
  bool _openingClient = false;
  String? _error;

  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);

  DayAppointment get a => widget.appointment;

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
            appointmentId: a.id,
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
    startAppointmentCheckout(ref, a);
    Navigator.pop(context);
    context.go('/app/cash');
  }

  Future<void> _openClient() async {
    final clientId = a.clientId;
    if (clientId == null || clientId.isEmpty) {
      _snack('Aucune fiche liée à ce rendez-vous.');
      return;
    }
    final token = ref.read(accessTokenProvider);
    final tenantId = ref.read(selectedTenantIdProvider);
    if (token == null || tenantId == null) return;

    setState(() {
      _openingClient = true;
      _error = null;
    });
    try {
      final dossier = await ref.read(mobileApiProvider).fetchClientDossier(
            accessToken: token,
            tenantId: tenantId,
            clientId: clientId,
          );
      if (!mounted) return;
      Navigator.pop(context);
      await showClientDetailSheet(context: context, client: dossier.client);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _openingClient = false);
    }
  }

  Future<void> _editAppointment() async {
    final cancelled = a.isCancelled || a.status == 'completed';
    if (cancelled) return;
    final updated = await showEditAppointmentSheet(context, a);
    if (updated && mounted) {
      ref.invalidate(dayAgendaProvider);
      ref.invalidate(todayAgendaProvider);
      Navigator.pop(context);
    }
  }

  Future<void> _launch(Uri uri) async {
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok && mounted) _snack('Impossible d’ouvrir');
  }

  void _copy(String value, String label) {
    Clipboard.setData(ClipboardData(text: value));
    _snack('$label copié');
  }

  void _snack(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 2),
      ),
    );
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

  String _digits(String phone) => phone.replaceAll(RegExp(r'[^\d+]'), '');

  @override
  Widget build(BuildContext context) {
    final dateFmt = DateFormat('EEEE d MMMM', 'fr_FR');
    final timeFmt = DateFormat.Hm();
    final cancelled = a.isCancelled;
    final phone = a.clientPhone?.trim();
    final email = a.clientEmail?.trim();
    final hasClient = a.clientId != null && a.clientId!.isNotEmpty;

    final tablet = MediaQuery.sizeOf(context).shortestSide >= 600;
    final details = <Widget>[
      Text(
        a.clientName,
        style: TextStyle(
          fontSize: tablet ? 26 : 22,
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
      if (a.extras.isNotEmpty) ...[
        const SizedBox(height: 4),
        Text(
          a.extras
              .map(
                (e) => e.quantity > 1 ? '${e.name} ×${e.quantity}' : e.name,
              )
              .join(' · '),
          style: const TextStyle(fontSize: 13, color: _muted),
        ),
      ],
      const SizedBox(height: 16),
      _DetailRow(
        icon: Icons.schedule_outlined,
        label:
            '${dateFmt.format(a.startsAt)} · ${timeFmt.format(a.startsAt)} – ${timeFmt.format(a.endsAt)}',
      ),
      if (a.resourceName != null)
        _DetailRow(
          icon: Icons.meeting_room_outlined,
          label: a.resourceName!,
        ),
      if (a.staffName != null)
        _DetailRow(
          icon: Icons.person_outline,
          label: a.staffName!,
        ),
      if (phone != null && phone.isNotEmpty)
        _ContactRow(
          icon: Icons.phone_outlined,
          label: phone,
          actions: [
            _ContactAction(
              icon: Icons.call_outlined,
              tooltip: 'Appeler',
              onTap: () => _launch(Uri.parse('tel:${_digits(phone)}')),
            ),
            _ContactAction(
              icon: Icons.sms_outlined,
              tooltip: 'SMS',
              onTap: () => _launch(Uri.parse('sms:${_digits(phone)}')),
            ),
            _ContactAction(
              icon: Icons.copy_outlined,
              tooltip: 'Copier',
              onTap: () => _copy(phone, 'Numéro'),
            ),
          ],
        ),
      if (email != null && email.isNotEmpty)
        _ContactRow(
          icon: Icons.mail_outline,
          label: email,
          actions: [
            _ContactAction(
              icon: Icons.send_outlined,
              tooltip: 'Écrire',
              onTap: () => _launch(Uri.parse('mailto:$email')),
            ),
            _ContactAction(
              icon: Icons.copy_outlined,
              tooltip: 'Copier',
              onTap: () => _copy(email, 'E-mail'),
            ),
          ],
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
        const SizedBox(height: 4),
        Text(
          a.notes!,
          style: const TextStyle(fontSize: 14, color: _muted, height: 1.4),
        ),
      ],
      if (_error != null) ...[
        const SizedBox(height: 12),
        Text(_error!, style: const TextStyle(color: Colors.red)),
      ],
    ];
    final actions = <Widget>[
      if (hasClient)
        OutlinedButton.icon(
          onPressed: _openingClient ? null : _openClient,
          icon: _openingClient
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.person_outline, size: 18),
          label: const Text('Fiche cliente'),
          style: OutlinedButton.styleFrom(
            foregroundColor: _black,
            side: const BorderSide(color: Color(0xFFE8E8E8)),
            padding: const EdgeInsets.symmetric(vertical: 12),
          ),
        ),
      if (!cancelled && a.status != 'completed') ...[
        if (hasClient) const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: _updating ? null : _editAppointment,
          icon: const Icon(Icons.event_repeat_outlined, size: 18),
          label: const Text('Modifier / reprogrammer'),
          style: OutlinedButton.styleFrom(
            foregroundColor: _black,
            side: const BorderSide(color: Color(0xFFE8E8E8)),
            padding: const EdgeInsets.symmetric(vertical: 12),
          ),
        ),
        const SizedBox(height: 8),
        FilledButton(
          onPressed: _updating ? null : _openCheckout,
          child: const Text('Encaisser'),
        ),
      ],
      if (!cancelled) ...[
        const SizedBox(height: 10),
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
    ];

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          tablet ? 36 : 24,
          12,
          tablet ? 36 : 24,
          24 + MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: SingleChildScrollView(
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
              if (tablet)
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      flex: 5,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: details,
                      ),
                    ),
                    const SizedBox(width: 40),
                    Expanded(
                      flex: 4,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: actions,
                      ),
                    ),
                  ],
                )
              else ...[
                ...details,
                if (actions.isNotEmpty) const SizedBox(height: 18),
                ...actions,
              ],
            ],
          ),
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

class _ContactRow extends StatelessWidget {
  const _ContactRow({
    required this.icon,
    required this.label,
    required this.actions,
  });

  final IconData icon;
  final String label;
  final List<_ContactAction> actions;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
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
          for (final action in actions)
            IconButton(
              onPressed: action.onTap,
              tooltip: action.tooltip,
              visualDensity: VisualDensity.compact,
              icon: Icon(action.icon, size: 18),
            ),
        ],
      ),
    );
  }
}

class _ContactAction {
  const _ContactAction({
    required this.icon,
    required this.tooltip,
    required this.onTap,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;
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

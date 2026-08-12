import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../state/session_providers.dart';

Future<void> showCreateAppointmentSheet(
  BuildContext context,
  WidgetRef ref, {
  DateTime? initialDate,
  TimeOfDay? initialTime,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (ctx) => _CreateAppointmentSheet(
      initialDate: initialDate,
      initialTime: initialTime,
    ),
  );
}

class _CreateAppointmentSheet extends ConsumerStatefulWidget {
  const _CreateAppointmentSheet({
    this.initialDate,
    this.initialTime,
  });

  final DateTime? initialDate;
  final TimeOfDay? initialTime;

  @override
  ConsumerState<_CreateAppointmentSheet> createState() =>
      _CreateAppointmentSheetState();
}

class _CreateAppointmentSheetState
    extends ConsumerState<_CreateAppointmentSheet> {
  String? _serviceId;
  String? _clientId;
  String? _staffId;
  late DateTime _date;
  late TimeOfDay _time;
  final _notesController = TextEditingController();
  bool _saving = false;
  String? _error;

  static const _black = Color(0xFF0A0A0A);

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _date = widget.initialDate ?? DateTime(now.year, now.month, now.day);
    _time = widget.initialTime ??
        TimeOfDay(hour: now.hour, minute: (now.minute ~/ 15 + 1) * 15 % 60);
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime.now().subtract(const Duration(days: 1)),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      locale: const Locale('fr', 'FR'),
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _pickTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _time,
    );
    if (picked != null) setState(() => _time = picked);
  }

  Future<void> _save() async {
    if (_serviceId == null || _serviceId!.isEmpty) {
      setState(() => _error = 'Choisissez une prestation.');
      return;
    }

    final token = ref.read(accessTokenProvider);
    final tenantId = ref.read(selectedTenantIdProvider);
    if (token == null || tenantId == null) return;

    final startsAt = DateTime(
      _date.year,
      _date.month,
      _date.day,
      _time.hour,
      _time.minute,
    );

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      await ref.read(mobileApiProvider).createAppointment(
            accessToken: token,
            tenantId: tenantId,
            serviceId: _serviceId!,
            startsAt: startsAt.toUtc().toIso8601String(),
            clientId: _clientId,
            staffId: _staffId,
            notes: _notesController.text.trim(),
          );
      ref.invalidate(dayAgendaProvider);
      ref.invalidate(todayAgendaProvider);
      if (mounted) Navigator.pop(context);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final posAsync = ref.watch(posContextProvider);
    final dateFmt = DateFormat('EEEE d MMMM', 'fr_FR');
    final timeFmt = DateFormat.Hm();

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: 24,
          right: 24,
          top: 12,
          bottom: MediaQuery.viewInsetsOf(context).bottom + 24,
        ),
        child: posAsync.when(
          loading: () => const SizedBox(
            height: 280,
            child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
          ),
          error: (e, _) => Text('$e'),
          data: (pos) {
            final services = pos.catalog
                .where((item) => item.type == 'service')
                .toList();

            return SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
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
                  const Text(
                    'Nouveau rendez-vous',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: _black,
                    ),
                  ),
                  const SizedBox(height: 20),
                  _FieldLabel('Prestation'),
                  DropdownButtonFormField<String>(
                    value: _serviceId,
                    decoration: _inputDecoration(),
                    hint: const Text('Choisir…'),
                    items: services
                        .map(
                          (s) => DropdownMenuItem(
                            value: s.id,
                            child: Text(
                              s.durationMin != null
                                  ? '${s.name} · ${s.durationMin} min'
                                  : s.name,
                            ),
                          ),
                        )
                        .toList(),
                    onChanged: (v) => setState(() => _serviceId = v),
                  ),
                  const SizedBox(height: 14),
                  _FieldLabel('Cliente'),
                  DropdownButtonFormField<String>(
                    value: _clientId,
                    decoration: _inputDecoration(),
                    hint: const Text('Sans cliente'),
                    items: [
                      const DropdownMenuItem(
                        value: null,
                        child: Text('Sans cliente'),
                      ),
                      ...pos.clients.map(
                        (c) => DropdownMenuItem(
                          value: c.id,
                          child: Text(c.label, overflow: TextOverflow.ellipsis),
                        ),
                      ),
                    ],
                    onChanged: (v) => setState(() => _clientId = v),
                  ),
                  const SizedBox(height: 14),
                  _FieldLabel('Praticienne'),
                  DropdownButtonFormField<String>(
                    value: _staffId,
                    decoration: _inputDecoration(),
                    hint: const Text('Non assignée'),
                    items: [
                      const DropdownMenuItem(
                        value: null,
                        child: Text('Non assignée'),
                      ),
                      ...pos.staff.map(
                        (s) => DropdownMenuItem(
                          value: s.id,
                          child: Text(s.label),
                        ),
                      ),
                    ],
                    onChanged: (v) => setState(() => _staffId = v),
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const _FieldLabel('Date'),
                            OutlinedButton(
                              onPressed: _pickDate,
                              style: _outlineStyle(),
                              child: Align(
                                alignment: Alignment.centerLeft,
                                child: Text(
                                  dateFmt.format(_date),
                                  style: const TextStyle(color: _black),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const _FieldLabel('Heure'),
                            OutlinedButton(
                              onPressed: _pickTime,
                              style: _outlineStyle(),
                              child: Align(
                                alignment: Alignment.centerLeft,
                                child: Text(
                                  timeFmt.format(DateTime(
                                    _date.year,
                                    _date.month,
                                    _date.day,
                                    _time.hour,
                                    _time.minute,
                                  )),
                                  style: const TextStyle(color: _black),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  const _FieldLabel('Notes'),
                  TextField(
                    controller: _notesController,
                    decoration: _inputDecoration(hint: 'Optionnel'),
                    maxLines: 2,
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Text(_error!, style: const TextStyle(color: Colors.red)),
                  ],
                  const SizedBox(height: 20),
                  FilledButton(
                    onPressed: _saving ? null : _save,
                    child: _saving
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text('Créer le rendez-vous'),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  InputDecoration _inputDecoration({String? hint}) {
    return InputDecoration(
      hintText: hint,
      filled: true,
      fillColor: const Color(0xFFF8F8F8),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFFE8E8E8)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFFE8E8E8)),
      ),
    );
  }

  ButtonStyle _outlineStyle() {
    return OutlinedButton.styleFrom(
      foregroundColor: _black,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      side: const BorderSide(color: Color(0xFFE8E8E8)),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(
        text.toUpperCase(),
        style: const TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.6,
          color: Color(0xFF737373),
        ),
      ),
    );
  }
}
